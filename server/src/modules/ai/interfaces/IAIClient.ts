import { IToolDefinition, IToolCall } from './ITool';

export interface IAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: IToolCall[];
  toolCallId?: string;
}

export interface IAIResponse {
  id: string;
  content?: string;
  toolCalls?: IToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface IAIRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: IToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none';
  responseFormat?: {
    type: 'json_object' | 'text';
    schema?: any;
  };
}

export interface IAIClient {
  generateResponse(messages: IAIMessage[], options?: IAIRequestOptions): Promise<IAIResponse>;

  continueConversation(
    toolCallResults: Array<{ toolCallId: string; result: string }>,
    options?: IAIRequestOptions
  ): Promise<IAIResponse>;
}
