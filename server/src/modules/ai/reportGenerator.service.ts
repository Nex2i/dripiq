/**
 * Enhanced Report Generator Service with Proper Function Calling Loop
 *
 * This service implements a robust function calling system using the OpenAI Responses API:
 *
 * ✅ **Key Improvements:**
 * - Uses the modern OpenAI Responses API (not the older Chat Completions API)
 * - Implements a proper iterative loop that feeds function results back to the AI
 * - Handles multiple function calls in parallel within each iteration
 * - Includes comprehensive error handling and recovery mechanisms
 * - Provides detailed logging and function call history tracking
 * - Supports configurable maximum iterations to prevent infinite loops
 * - Returns structured results with iteration count and function call history
 *
 * ✅ **Function Calling Flow:**
 * 1. Send initial prompt to AI with available tools using Responses API
 * 2. If AI requests function calls, execute them in parallel
 * 3. Feed all function results back to the AI using proper format
 * 4. Repeat until AI provides final response (no more function calls)
 * 5. Return comprehensive result with history and metadata
 *
 * ✅ **Usage Examples:**
 * ```typescript
 * // Simple site analysis
 * const result = await ReportGeneratorService.summarizeSite('example.com');
 * console.log(result.finalResponse);
 * console.log(`Completed in ${result.totalIterations} iterations`);
 *
 * // Custom function calling with your own tools
 * const customResult = await ReportGeneratorService.executeFunctionCallLoop(
 *   input,
 *   tools,
 *   maxIterations
 * );
 * ```
 *
 * ✅ **Error Handling:**
 * - Graceful handling of function execution errors
 * - Automatic retry with error context provided to AI
 * - Maximum iteration limits to prevent runaway loops
 * - Comprehensive logging for debugging
 */

import { openAiClient } from '@/libs/openai.client';
import {
  GetInformationAboutDomainTool,
  DomainInformation,
  getDomainInformationTool,
} from './tools/GetInformationAboutDomain';
import { promptHelper } from '@/prompts/prompt.helper';
import {
  ResponseCreateParamsNonStreaming,
  ResponseInputItem,
  Tool,
} from 'openai/resources/responses/responses';
import { SiteEmbeddingDomain } from '@/db';
import {
  listDomainPagesTool,
  ListDomainPagesTool,
  ListDomainPagesToolResponse,
} from './tools/ListDomainPages';
import {
  retrieveFullPageTool,
  RetrieveFullPageTool,
  RetrieveFullPageToolResponse,
} from './tools/RetrieveFullPage';

interface FunctionCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface FunctionCallLoopResult {
  finalResponse: string;
  totalIterations: number;
  functionCalls: Array<{
    functionName: string;
    arguments: any;
    result: FunctionCallResult;
  }>;
}

export const ReportGeneratorService = {
  summarizeSite: async (siteUrl: string): Promise<FunctionCallLoopResult> => {
    const tools: Array<Tool> = [
      getDomainInformationTool,
      listDomainPagesTool,
      retrieveFullPageTool,
    ];

    const initialPrompt = promptHelper.getPromptAndInject('summarize_site', {
      domain: siteUrl,
    });

    const input: Array<ResponseInputItem> = [
      {
        role: 'system' as const,
        content:
          'You are a helpful assistant that summarizes companies when provided their websites. Use the available tools to gather information about the domain and provide a comprehensive summary.',
      },
      {
        role: 'user' as const,
        content: initialPrompt,
      },
    ];

    return await ReportGeneratorService.executeFunctionCallLoop(input, tools);
  },

  executeFunctionCallLoop: async (
    initialInput: Array<ResponseInputItem>,
    tools: Array<Tool>,
    maxIterations: number = 10
  ): Promise<FunctionCallLoopResult> => {
    const functionCallHistory: Array<{
      functionName: string;
      arguments: any;
      result: FunctionCallResult;
    }> = [];

    let iteration = 0;
    let previousResponseId: string | undefined;
    let currentResponse: any = null;

    while (iteration < maxIterations) {
      iteration++;

      try {
        console.log(`Function call loop iteration ${iteration}`);

        // Make the API call to OpenAI using Responses API (only for first iteration)
        if (iteration === 1) {
          const requestParams: ResponseCreateParamsNonStreaming = {
            model: 'gpt-4o-mini',
            input: initialInput,
            tools,
            tool_choice: 'auto',
            temperature: 0.7,
          };

          currentResponse = await openAiClient.responses.create(requestParams);
          previousResponseId = currentResponse.id;
        }

        // Check the output for function calls
        const functionCalls =
          currentResponse?.output?.filter((item: any) => item.type === 'function_call') || [];

        if (functionCalls.length > 0) {
          console.log(`Processing ${functionCalls.length} function calls`);

          // Execute all function calls in parallel
          const toolResults = await Promise.allSettled(
            functionCalls.map(async (toolCall: any) => {
              const functionName = toolCall.name;
              const functionArgs = JSON.parse(toolCall.arguments || '{}');

              console.log(`Executing function: ${functionName} with args:`, functionArgs);

              const result = await ReportGeneratorService.executeFunction(
                functionName,
                functionArgs
              );

              // Record the function call
              functionCallHistory.push({
                functionName,
                arguments: functionArgs,
                result,
              });

              // Return the function call and its output in the format expected by Responses API
              return [
                {
                  type: 'function_call',
                  call_id: toolCall.call_id,
                  name: functionName,
                  arguments: toolCall.arguments,
                },
                {
                  type: 'function_call_output',
                  call_id: toolCall.call_id,
                  output: result.success ? JSON.stringify(result.data) : `Error: ${result.error}`,
                },
              ];
            })
          );

          // Flatten the results and add them to our input for the next iteration
          const newInputItems: any[] = [];
          toolResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              newInputItems.push(...result.value);
            } else {
              console.error('Tool execution failed:', result.reason);
              // Add error message
              newInputItems.push({
                type: 'function_call_output',
                call_id: 'error',
                output: `Error executing tool: ${result.reason}`,
              });
            }
          });

          // Send function results back and get the model's response
          currentResponse = await openAiClient.responses.create({
            model: 'gpt-4o-mini',
            input: newInputItems,
            previous_response_id: previousResponseId,
            tools,
            tool_choice: 'auto',
            temperature: 0.7,
          });

          // Update response ID for next iteration
          previousResponseId = currentResponse.id;

          // Check if this response has more function calls
          const moreFunctionCalls =
            currentResponse.output?.filter((item: any) => item.type === 'function_call') || [];

          if (moreFunctionCalls.length === 0) {
            // Model is satisfied - EARLY EXIT
            const finalResponse = currentResponse.output_text || 'No response generated';

            console.log(
              `Function call loop completed after ${iteration} iterations (model satisfied)`
            );

            return {
              finalResponse,
              totalIterations: iteration,
              functionCalls: functionCallHistory,
            };
          }

          // Continue the loop - model wants to make more function calls
          console.log(
            `Model wants to make ${moreFunctionCalls.length} more function calls, continuing...`
          );
          continue;
        } else {
          // No function calls - model provided final response immediately
          const finalResponse = currentResponse.output_text || 'No response generated';

          console.log(
            `Function call loop completed after ${iteration} iterations (no tools needed)`
          );

          return {
            finalResponse,
            totalIterations: iteration,
            functionCalls: functionCallHistory,
          };
        }
      } catch (error) {
        console.error(`Error in function call loop iteration ${iteration}:`, error);

        // Try one more time without tools to get a final response
        if (iteration < maxIterations) {
          try {
            const finalResponse = await openAiClient.responses.create({
              model: 'gpt-4o-mini',
              input: 'Please provide a summary based on the information you have so far.',
              previous_response_id: previousResponseId,
              temperature: 0.7,
            });

            return {
              finalResponse: finalResponse.output_text || 'Error occurred during processing',
              totalIterations: iteration,
              functionCalls: functionCallHistory,
            };
          } catch (finalError) {
            console.error('Final response generation failed:', finalError);
          }
        }

        throw error;
      }
    }

    // Max iterations reached
    console.warn(`Function call loop reached maximum iterations (${maxIterations})`);

    // Get final response without tools
    try {
      const finalResponse = await openAiClient.responses.create({
        model: 'gpt-4o-mini',
        input: 'Please provide a final summary based on all the information gathered so far.',
        previous_response_id: previousResponseId,
        temperature: 0.7,
      });

      return {
        finalResponse: finalResponse.output_text || 'Maximum iterations reached',
        totalIterations: iteration,
        functionCalls: functionCallHistory,
      };
    } catch (error) {
      console.error('Final summary generation failed:', error);
      return {
        finalResponse: 'Maximum iterations reached and final summary failed',
        totalIterations: iteration,
        functionCalls: functionCallHistory,
      };
    }
  },

  executeFunction: async (functionName: string, args: any): Promise<FunctionCallResult> => {
    try {
      console.log(`Executing function: ${functionName}`);

      switch (functionName) {
        case 'GetInformationAboutDomainTool':
          const domainInfo: DomainInformation = await GetInformationAboutDomainTool(
            args?.domain,
            args?.query_text,
            args?.top_k
          );
          return {
            success: true,
            data: domainInfo,
          };

        case 'ListDomainPagesTool':
          const pages: ListDomainPagesToolResponse = await ListDomainPagesTool(args?.domain);
          return {
            success: true,
            data: pages,
          };

        case 'RetrieveFullPageTool':
          const fullPage: RetrieveFullPageToolResponse = await RetrieveFullPageTool(args?.url);
          return {
            success: true,
            data: fullPage,
          };

        default:
          return {
            success: false,
            error: `Unknown function: ${functionName}`,
          };
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};
