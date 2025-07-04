export interface IToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface IToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ITool {
  getDefinition(): IToolDefinition;
  execute(args: any): Promise<IToolResult>;
}

export interface IToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface IToolCallResult {
  id: string;
  result: IToolResult;
}
