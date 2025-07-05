import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { logger } from '@/libs/logger';
import { promptHelper } from '@/prompts/prompt.helper';

// Import interfaces
import { IAIClient, IAIMessage, IAIRequestOptions } from '../interfaces/IAIClient';
import { IToolRegistry } from '../interfaces/IToolRegistry';
import { ITool, IToolCall } from '../interfaces/ITool';
import { ReportConfig, FunctionCallLoopResult } from '../interfaces/IReport';
import vendorFitOutputSchema from '../schemas/vendorFitOutputSchema';
import vendorFitInputSchema from '../schemas/vendorFitInputSchema';

export class VendorFitReportService {
  private aiClient: IAIClient;
  private toolRegistry: IToolRegistry;
  private config: Required<ReportConfig>;

  constructor(aiClient: IAIClient, toolRegistry: IToolRegistry, config: ReportConfig = {}) {
    this.aiClient = aiClient;
    this.toolRegistry = toolRegistry;
    this.config = {
      maxIterations: config.maxIterations || 10,
      model: config.model || 'gpt-4.1',
      enableWebSearch: config.enableWebSearch ?? false,
    };
  }

  // Method to register tools at runtime
  registerTool(tool: ITool): void {
    this.toolRegistry.registerTool(tool);
  }

  // Method to register multiple tools
  registerTools(tools: ITool[]): void {
    tools.forEach((tool) => this.registerTool(tool));
  }

  async generateVendorFitReport(
    partnerDetails: z.infer<typeof vendorFitInputSchema>,
    opportunityDetails: z.infer<typeof vendorFitInputSchema>
  ): Promise<FunctionCallLoopResult<z.infer<typeof vendorFitOutputSchema>>> {
    const outputSchema = zodToJsonSchema(vendorFitOutputSchema, 'vendorFitOutputSchema');

    const initialPrompt = promptHelper.getPromptAndInject('vendor_fit', {
      input_schema: JSON.stringify(vendorFitInputSchema, null, 2),
      output_schema: JSON.stringify(outputSchema, null, 2),
      partner_details: JSON.stringify(partnerDetails, null, 2),
      opportunity_details: JSON.stringify(opportunityDetails, null, 2),
    });

    const messages: IAIMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant that generates a vendor fit report for a given partner and opportunity. \n' +
          'Use the available tools to gather information about the partner and opportunity and provide a comprehensive report. \n' +
          'For your final response you must return JSON. The JSON must be valid and match the schema provided.',
      },
      {
        role: 'user',
        content: initialPrompt,
      },
    ];

    const options: IAIRequestOptions = {
      model: this.config.model,
      tools: this.toolRegistry.getToolDefinitions(),
      toolChoice: 'required',
      enableWebSearch: this.config.enableWebSearch,
      responseFormat: {
        type: 'json_object',
        schema: vendorFitOutputSchema,
      },
    };

    const output = await this.executeFunctionCallLoop(messages, options);

    // Parse final output to vendorFitOutputSchema
    try {
      const finalOutput = vendorFitOutputSchema.parse(JSON.parse(output.finalResponse));
      return {
        ...output,
        finalResponseParsed: finalOutput,
      };
    } catch (parseError) {
      logger.error('Failed to parse final response:', parseError);
      return output;
    }
  }

  private async executeFunctionCallLoop(
    initialMessages: IAIMessage[],
    options: IAIRequestOptions
  ): Promise<FunctionCallLoopResult<z.infer<typeof vendorFitOutputSchema>>> {
    let iteration = 0;
    let currentResponse: any = null;
    const functionCallHistory: Array<{
      functionName: string;
      arguments: any;
      result: any;
    }> = [];

    // First request
    try {
      currentResponse = await this.aiClient.generateResponse(initialMessages, options);
      iteration++;
    } catch (error) {
      logger.error('Error in initial AI request:', error);
      return {
        finalResponse: 'Error occurred during initial processing',
        totalIterations: iteration,
        functionCalls: functionCallHistory,
      };
    }

    while (iteration < this.config.maxIterations) {
      try {
        // Check if we have tool calls to execute
        if (currentResponse.toolCalls && currentResponse.toolCalls.length > 0) {
          // Execute all tool calls in parallel
          const toolCallResults = await Promise.allSettled(
            currentResponse.toolCalls.map(async (toolCall: IToolCall) => {
              const result = await this.toolRegistry.executeTool(toolCall.name, toolCall.arguments);

              // Record the function call
              functionCallHistory.push({
                functionName: toolCall.name,
                arguments: toolCall.arguments,
                result,
              });

              return {
                toolCallId: toolCall.id,
                result: result.success ? JSON.stringify(result.data) : `Error: ${result.error}`,
              };
            })
          );

          // Process results and prepare for next request
          const successfulResults: Array<{ toolCallId: string; result: string }> = [];
          toolCallResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              successfulResults.push(result.value);
            } else {
              logger.error('Tool execution failed:', result.reason);
              // Add error result
              const toolCall = currentResponse.toolCalls[index];
              successfulResults.push({
                toolCallId: toolCall.id,
                result: `Error executing tool: ${result.reason}`,
              });
            }
          });

          // Continue conversation with tool results
          currentResponse = await this.aiClient.continueConversation(successfulResults, options);
          iteration++;

          // Check if this response has more tool calls
          if (!currentResponse.toolCalls || currentResponse.toolCalls.length === 0) {
            // Model is satisfied - return final response
            return {
              finalResponse: currentResponse.content || 'No response generated',
              totalIterations: iteration,
              functionCalls: functionCallHistory,
            };
          }

          // Continue the loop - model wants to make more tool calls
          continue;
        } else {
          // No tool calls - model provided final response
          return {
            finalResponse: currentResponse.content || 'No response generated',
            totalIterations: iteration,
            functionCalls: functionCallHistory,
          };
        }
      } catch (error) {
        logger.error(`Error in function call loop iteration ${iteration}:`, error);

        // Try to get a final response without tools
        try {
          const finalMessages: IAIMessage[] = [
            {
              role: 'user',
              content: 'Please provide a summary based on the information you have so far.',
            },
          ];

          const finalResponse = await this.aiClient.generateResponse(finalMessages, {
            ...options,
            toolChoice: 'none',
          });

          return {
            finalResponse: finalResponse.content || 'Error occurred during processing',
            totalIterations: iteration,
            functionCalls: functionCallHistory,
          };
        } catch (finalError) {
          logger.error('Final response generation failed:', finalError);
        }

        throw error;
      }
    }

    // Max iterations reached - try to get a final summary
    try {
      const finalMessages: IAIMessage[] = [
        {
          role: 'user',
          content: 'Please provide a final summary based on all the information gathered so far.',
        },
      ];

      const finalResponse = await this.aiClient.generateResponse(finalMessages, {
        ...options,
        toolChoice: 'none',
      });

      return {
        finalResponse: finalResponse.content || 'Maximum iterations reached',
        totalIterations: iteration,
        functionCalls: functionCallHistory,
      };
    } catch (error) {
      logger.error('Final summary generation failed:', error);
    }

    return {
      finalResponse: 'Maximum iterations reached and final summary failed',
      totalIterations: iteration,
      functionCalls: functionCallHistory,
    };
  }
}
