import z from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { logger } from '@/libs/logger';
import { promptHelper } from '@/prompts/prompt.helper';
import reportOutputSchema from '../schemas/reportOutputSchema';

// Import interfaces
import { IAIClient, IAIMessage, IAIRequestOptions, IAIResponse } from '../interfaces/IAIClient';
import { IToolRegistry } from '../interfaces/IToolRegistry';
import { ITool, IToolCall } from '../interfaces/ITool';
import { ReportConfig, FunctionCallLoopResult } from '../interfaces/IReport';
import { AI_MODELS, ServiceResult, ToolExecutionResult, FunctionCallRecord } from './shared';

export class GeneralSiteReportService {
  private aiClient: IAIClient;
  private toolRegistry: IToolRegistry;
  private config: Required<ReportConfig>;

  constructor(aiClient: IAIClient, toolRegistry: IToolRegistry, config: ReportConfig = {}) {
    this.aiClient = aiClient;
    this.toolRegistry = toolRegistry;

    // Use object spread to merge config defaults with user-supplied config
    this.config = {
      maxIterations: 10,
      model: AI_MODELS.GPT_4_1,
      enableWebSearch: false,
      ...config,
    };
  }

  // Method to register tools at runtime
  registerTool(tool: ITool): void {
    this.toolRegistry.registerTool(tool);
  }

  // Method to register multiple tools
  registerTools(tools: ITool[]): void {
    if (!tools?.length) {
      logger.warn('Attempted to register empty or null tool array');
      return;
    }
    tools.forEach((tool) => this.registerTool(tool));
  }

  async summarizeSite(
    siteUrl: string
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
    try {
      const outputSchema = zodToJsonSchema(reportOutputSchema, 'reportOutputSchema');

      const initialPrompt = promptHelper.getPromptAndInject('summarize_site', {
        domain: siteUrl,
        output_schema: JSON.stringify(outputSchema, null, 2),
      });

      const messages: IAIMessage[] = [
        {
          role: 'system',
          content:
            'You are a helpful assistant that summarizes companies when provided their websites. \n' +
            'Use the available tools to gather information about the domain and provide a comprehensive summary. \n' +
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
          schema: reportOutputSchema,
        },
      };

      const loopResult = await this.executeFunctionCallLoop(messages, options);

      if (!loopResult.success) {
        return loopResult;
      }

      // Parse final output to reportOutputSchema
      const parseResult = this.parseFinalResponse(loopResult.data.finalResponse);
      if (!parseResult.success) {
        return {
          success: false,
          error: 'Failed to parse final response',
          details: parseResult.error,
        };
      }

      return {
        success: true,
        data: {
          ...loopResult.data,
          finalResponseParsed: parseResult.data,
        },
      };
    } catch (error) {
      logger.error('Error in summarizeSite:', error);
      return {
        success: false,
        error: 'Failed to summarize site',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private parseFinalResponse(response: string): ServiceResult<z.infer<typeof reportOutputSchema>> {
    try {
      const parsed = reportOutputSchema.parse(JSON.parse(response));
      return {
        success: true,
        data: parsed,
      };
    } catch (parseError) {
      logger.error('Failed to parse final response:', parseError);
      return {
        success: false,
        error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
      };
    }
  }

  private async executeFunctionCallLoop(
    initialMessages: IAIMessage[],
    options: IAIRequestOptions
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
    let iteration = 0;
    let currentResponse: IAIResponse | null = null;
    const functionCallHistory: FunctionCallRecord[] = [];

    // First request
    const initialResult = await this.makeInitialRequest(initialMessages, options);
    if (!initialResult.success) {
      return {
        success: false,
        error: 'Failed to make initial AI request',
        details: initialResult.error,
      };
    }

    currentResponse = initialResult.data;
    iteration++;

    while (iteration < this.config.maxIterations) {
      // Check if we have tool calls to execute
      if (currentResponse.toolCalls?.length) {
        const toolResult = await this.executeToolCalls(
          currentResponse.toolCalls,
          functionCallHistory
        );
        if (!toolResult.success) {
          return await this.handleToolExecutionFailure(
            options,
            iteration,
            functionCallHistory,
            toolResult.error
          );
        }

        // Continue conversation with tool results
        const continueResult = await this.continueConversation(toolResult.data, options);
        if (!continueResult.success) {
          return await this.handleContinuationFailure(
            options,
            iteration,
            functionCallHistory,
            continueResult.error
          );
        }

        currentResponse = continueResult.data;
        iteration++;

        // Check if this response has more tool calls
        if (!currentResponse.toolCalls?.length) {
          // Model is satisfied - return final response
          return {
            success: true,
            data: {
              finalResponse: currentResponse.content || 'No response generated',
              totalIterations: iteration,
              functionCalls: functionCallHistory,
            },
          };
        }

        // Continue the loop - model wants to make more tool calls
        continue;
      } else {
        // No tool calls - model provided final response
        return {
          success: true,
          data: {
            finalResponse: currentResponse.content || 'No response generated',
            totalIterations: iteration,
            functionCalls: functionCallHistory,
          },
        };
      }
    }

    // Max iterations reached - try to get a final summary
    return await this.handleMaxIterationsReached(options, iteration, functionCallHistory);
  }

  private async makeInitialRequest(
    messages: IAIMessage[],
    options: IAIRequestOptions
  ): Promise<ServiceResult<IAIResponse>> {
    try {
      const response = await this.aiClient.generateResponse(messages, options);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error('Error in initial AI request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in initial request',
      };
    }
  }

  private async executeToolCalls(
    toolCalls: IToolCall[],
    functionCallHistory: FunctionCallRecord[]
  ): Promise<ServiceResult<ToolExecutionResult[]>> {
    try {
      // Execute all tool calls in parallel
      const toolCallResults = await Promise.allSettled(
        toolCalls.map(async (toolCall: IToolCall) => {
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

      // Process results
      const successfulResults: ToolExecutionResult[] = [];
      toolCallResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          logger.error('Tool execution failed:', result.reason);
          // Add error result
          const toolCall = toolCalls[index];
          if (toolCall) {
            successfulResults.push({
              toolCallId: toolCall.id,
              result: `Error executing tool: ${result.reason}`,
            });
          }
        }
      });

      return {
        success: true,
        data: successfulResults,
      };
    } catch (error) {
      logger.error('Error in tool execution:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in tool execution',
      };
    }
  }

  private async continueConversation(
    toolResults: ToolExecutionResult[],
    options: IAIRequestOptions
  ): Promise<ServiceResult<IAIResponse>> {
    try {
      const response = await this.aiClient.continueConversation(toolResults, options);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error('Error continuing conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error continuing conversation',
      };
    }
  }

  private async handleToolExecutionFailure(
    options: IAIRequestOptions,
    iteration: number,
    functionCallHistory: FunctionCallRecord[],
    error: string
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
    logger.error(`Tool execution failed at iteration ${iteration}:`, error);
    return await this.getFallbackResponse(
      options,
      iteration,
      functionCallHistory,
      'Tool execution failed'
    );
  }

  private async handleContinuationFailure(
    options: IAIRequestOptions,
    iteration: number,
    functionCallHistory: FunctionCallRecord[],
    error: string
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
    logger.error(`Conversation continuation failed at iteration ${iteration}:`, error);
    return await this.getFallbackResponse(
      options,
      iteration,
      functionCallHistory,
      'Conversation continuation failed'
    );
  }

  private async handleMaxIterationsReached(
    options: IAIRequestOptions,
    iteration: number,
    functionCallHistory: FunctionCallRecord[]
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
    logger.warn(`Maximum iterations (${this.config.maxIterations}) reached`);
    return await this.getFallbackResponse(
      options,
      iteration,
      functionCallHistory,
      'Maximum iterations reached'
    );
  }

  private async getFallbackResponse(
    options: IAIRequestOptions,
    iteration: number,
    functionCallHistory: FunctionCallRecord[],
    reason: string
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
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
        success: true,
        data: {
          finalResponse: finalResponse.content || `${reason} - no final summary available`,
          totalIterations: iteration,
          functionCalls: functionCallHistory,
        },
      };
    } catch (error) {
      logger.error('Final summary generation failed:', error);
      return {
        success: false,
        error: `${reason} and final summary generation failed`,
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
