import { zodTextFormat } from 'openai/helpers/zod';
import { ResponseInputItem, Tool } from 'openai/resources/responses/responses';
import { openAiClient } from '@/libs/openai.client';
import { promptHelper } from '@/prompts/prompt.helper';
import reportOutputSchema from './schemas/reportOutputSchema';
import {
  GetInformationAboutDomainTool,
  DomainInformation,
  getDomainInformationTool,
} from './tools/GetInformationAboutDomain';
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

export class ReportGeneratorService {
  private tools: Array<Tool>;
  private previousResponseId?: string;
  private functionCallHistory: Array<{
    functionName: string;
    arguments: any;
    result: FunctionCallResult;
  }> = [];
  private maxIterations: number;

  constructor(maxIterations: number = 10) {
    this.tools = [getDomainInformationTool, listDomainPagesTool, retrieveFullPageTool];
    this.maxIterations = maxIterations;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async makeOpenAIRequestWithRetry(
    input: Array<ResponseInputItem> | string,
    options: {
      model?: string;
      toolChoice?: 'auto' | 'required';
      isFirstRequest?: boolean;
    } = {},
    maxRetries: number = 3
  ): Promise<any> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.makeOpenAIRequest(input, options);
      } catch (error: any) {
        attempt++;

        if (error?.status === 429 && attempt < maxRetries) {
          // Rate limit error - extract wait time from error message or use exponential backoff
          const waitTime = this.extractWaitTimeFromError(error) || Math.pow(2, attempt) * 1000;
          console.log(
            `Rate limit hit, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`
          );
          await this.delay(waitTime);
          continue;
        }

        // If it's not a rate limit error or we've exhausted retries, throw the error
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private extractWaitTimeFromError(error: any): number | null {
    if (error?.message) {
      const match = error.message.match(/Please try again in ([\d.]+)s/);
      if (match) {
        return Math.ceil(parseFloat(match[1]) * 1000); // Convert to milliseconds and round up
      }
    }
    return null;
  }

  private async makeOpenAIRequest(
    input: Array<ResponseInputItem> | string,
    options: {
      model?: string;
      toolChoice?: 'auto' | 'required';
      isFirstRequest?: boolean;
    } = {}
  ) {
    const { model = 'gpt-4o-mini', toolChoice = 'auto', isFirstRequest = false } = options;

    const requestParams: any = {
      model: model,
      input,
      tools: this.tools,
      tool_choice: toolChoice,
      text: {
        format: zodTextFormat(reportOutputSchema, 'event'),
      },
    };

    if (this.previousResponseId && !isFirstRequest) {
      requestParams.previous_response_id = this.previousResponseId;
    }

    const response = await openAiClient.responses.create(requestParams);
    this.previousResponseId = response.id;
    return response;
  }

  async summarizeSite(siteUrl: string): Promise<FunctionCallLoopResult> {
    // Reset state for new summarization
    this.previousResponseId = undefined;
    this.functionCallHistory = [];

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

    return await this.executeFunctionCallLoop(input);
  }

  private async executeFunctionCallLoop(
    initialInput: Array<ResponseInputItem>
  ): Promise<FunctionCallLoopResult> {
    let iteration = 0;
    let currentResponse: any = null;
    let pendingFunctionCalls: any[] = [];

    while (iteration < this.maxIterations) {
      iteration++;

      try {
        console.log(`Function call loop iteration ${iteration}`);

        // Make the API call to OpenAI using Responses API (only for first iteration)
        if (iteration === 1) {
          currentResponse = await this.makeOpenAIRequestWithRetry(initialInput, {
            toolChoice: 'required',
            isFirstRequest: true,
          });
        }

        // Check the output for function calls
        const functionCalls =
          currentResponse?.output?.filter((item: any) => item.type === 'function_call') || [];

        if (functionCalls.length > 0) {
          console.log(`Processing ${functionCalls.length} function calls`);
          pendingFunctionCalls = functionCalls; // Store pending calls for error handling

          // Execute all function calls in parallel
          const toolResults = await Promise.allSettled(
            functionCalls.map(async (toolCall: any) => {
              const functionName = toolCall.name;
              const functionArgs = JSON.parse(toolCall.arguments || '{}');

              console.log(`Executing function: ${functionName} with args:`, functionArgs);

              const result = await this.executeFunction(functionName, functionArgs);

              // Record the function call
              this.functionCallHistory.push({
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
              // Add error message with proper call_id if available
              const failedCall = pendingFunctionCalls.find(() => true); // Get first pending call as fallback
              newInputItems.push({
                type: 'function_call_output',
                call_id: failedCall?.call_id || 'error',
                output: `Error executing tool: ${result.reason}`,
              });
            }
          });

          // Send function results back and get the model's response
          currentResponse = await this.makeOpenAIRequestWithRetry(newInputItems);
          pendingFunctionCalls = []; // Clear pending calls after successful response

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
              functionCalls: this.functionCallHistory,
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
            functionCalls: this.functionCallHistory,
          };
        }
      } catch (error) {
        console.error(`Error in function call loop iteration ${iteration}:`, error);

        // If we have pending function calls that failed due to rate limit,
        // don't try to make another request that would also fail
        if (pendingFunctionCalls.length > 0 && (error as any)?.status === 429) {
          console.log('Rate limit error with pending function calls, ending gracefully');
          return {
            finalResponse:
              'Summary generation interrupted due to rate limits. Please try again later.',
            totalIterations: iteration,
            functionCalls: this.functionCallHistory,
          };
        }

        // Try one more time without tools to get a final response (only if no pending calls)
        if (iteration < this.maxIterations && pendingFunctionCalls.length === 0) {
          try {
            const finalResponse = await this.makeOpenAIRequestWithRetry(
              'Please provide a summary based on the information you have so far.'
            );

            return {
              finalResponse: finalResponse.output_text || 'Error occurred during processing',
              totalIterations: iteration,
              functionCalls: this.functionCallHistory,
            };
          } catch (finalError) {
            console.error('Final response generation failed:', finalError);
          }
        }

        throw error;
      }
    }

    // Max iterations reached
    console.warn(`Function call loop reached maximum iterations (${this.maxIterations})`);

    // Get final response without tools (only if no pending function calls)
    if (pendingFunctionCalls.length === 0) {
      try {
        const finalResponse = await this.makeOpenAIRequestWithRetry(
          'Please provide a final summary based on all the information gathered so far.'
        );

        return {
          finalResponse: finalResponse.output_text || 'Maximum iterations reached',
          totalIterations: iteration,
          functionCalls: this.functionCallHistory,
        };
      } catch (error) {
        console.error('Final summary generation failed:', error);
      }
    }

    return {
      finalResponse: 'Maximum iterations reached and final summary failed',
      totalIterations: iteration,
      functionCalls: this.functionCallHistory,
    };
  }

  private async executeFunction(functionName: string, args: any): Promise<FunctionCallResult> {
    try {
      console.log(`Executing function: ${functionName}`);

      switch (functionName) {
        case 'GetInformationAboutDomainTool': {
          const domainInfo: DomainInformation = await GetInformationAboutDomainTool(
            args?.domain,
            args?.query_text,
            args?.top_k
          );
          return {
            success: true,
            data: domainInfo,
          };
        }

        case 'ListDomainPagesTool': {
          const pages: ListDomainPagesToolResponse = await ListDomainPagesTool(args?.domain);
          return {
            success: true,
            data: pages,
          };
        }

        case 'RetrieveFullPageTool': {
          const fullPage: RetrieveFullPageToolResponse = await RetrieveFullPageTool(args?.url);
          return {
            success: true,
            data: fullPage,
          };
        }

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
  }
}

export const reportGeneratorService = new ReportGeneratorService(5);
