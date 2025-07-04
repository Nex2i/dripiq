import { zodTextFormat } from 'openai/helpers/zod';
import {
  ResponseCreateParamsNonStreaming,
  ResponseInputItem,
  Tool,
} from 'openai/resources/responses/responses';
import { openAiClient } from '@/libs/openai.client';
import { IAIClient, IAIMessage, IAIResponse, IAIRequestOptions } from '../interfaces/IAIClient';
import { IToolDefinition, IToolCall } from '../interfaces/ITool';

export class OpenAIClient implements IAIClient {
  private previousResponseId?: string;

  async generateResponse(
    messages: IAIMessage[],
    options?: IAIRequestOptions
  ): Promise<IAIResponse> {
    // Reset previous response ID for new conversations
    this.previousResponseId = undefined;

    return await this.makeRequest(this.convertMessagesToInput(messages), options, true);
  }

  async continueConversation(
    toolCallResults: Array<{ toolCallId: string; result: string }>,
    options?: IAIRequestOptions
  ): Promise<IAIResponse> {
    const input = this.convertToolResultsToInput(toolCallResults);
    return await this.makeRequest(input, options, false);
  }

  private async makeRequest(
    input: Array<ResponseInputItem>,
    options?: IAIRequestOptions,
    isFirstRequest: boolean = false
  ): Promise<IAIResponse> {
    const tools = this.convertToolDefinitionsToOpenAI(options?.tools || []);

    const requestParams: ResponseCreateParamsNonStreaming = {
      model: options?.model || 'gpt-4.1',
      parallel_tool_calls: true,
      input,
      tools,
      tool_choice: options?.toolChoice || 'auto',
    };

    if (options?.enableWebSearch) {
      requestParams.tools?.push({
        type: 'web_search_preview',
        search_context_size: 'high',
        user_location: {
          type: 'approximate',
          city: 'United States',
          country: 'US',
        },
      });
    }

    // Add response format if specified
    if (options?.responseFormat?.type === 'json_object' && options.responseFormat.schema) {
      requestParams.text = {
        format: zodTextFormat(options.responseFormat.schema, 'event'),
      };
    }

    if (this.previousResponseId && !isFirstRequest) {
      requestParams.previous_response_id = this.previousResponseId;
    }

    const response = await openAiClient.responses.create(requestParams);
    this.previousResponseId = response.id;

    return this.convertOpenAIResponse(response);
  }

  private convertMessagesToInput(messages: IAIMessage[]): Array<ResponseInputItem> {
    return messages.map((message) => ({
      role: message.role as any,
      content: message.content,
    }));
  }

  private convertToolResultsToInput(
    toolCallResults: Array<{ toolCallId: string; result: string }>
  ): Array<ResponseInputItem> {
    const input: Array<ResponseInputItem> = [];

    toolCallResults.forEach(({ toolCallId, result }) => {
      input.push({
        type: 'function_call_output',
        call_id: toolCallId,
        output: result,
      } as any);
    });

    return input;
  }

  private convertToolDefinitionsToOpenAI(toolDefinitions: IToolDefinition[]): Tool[] {
    return toolDefinitions.map((tool) => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: false,
    }));
  }

  private convertOpenAIResponse(response: any): IAIResponse {
    const functionCalls =
      response?.output?.filter((item: any) => item.type === 'function_call') || [];

    const toolCalls: IToolCall[] = functionCalls.map((call: any) => ({
      id: call.call_id,
      name: call.name,
      arguments: JSON.parse(call.arguments || '{}'),
    }));

    const hasToolCalls = toolCalls.length > 0;

    return {
      id: response.id,
      content: response.output_text || undefined,
      toolCalls: hasToolCalls ? toolCalls : undefined,
      finishReason: hasToolCalls ? 'tool_calls' : 'stop',
    };
  }

  public async makeRequestWithRetry(
    input: Array<ResponseInputItem>,
    options?: IAIRequestOptions,
    isFirstRequest: boolean = false,
    maxRetries: number = 3
  ): Promise<IAIResponse> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.makeRequest(input, options, isFirstRequest);
      } catch (error: any) {
        attempt++;

        if (error?.status === 429 && attempt < maxRetries) {
          const waitTime = this.extractWaitTimeFromError(error) || Math.pow(2, attempt) * 1000;
          await this.delay(waitTime);
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private extractWaitTimeFromError(error: any): number | null {
    if (error?.message) {
      const match = error.message.match(/Please try again in ([\d.]+)s/);
      if (match) {
        return Math.ceil(parseFloat(match[1]) * 1000);
      }
    }
    return null;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
