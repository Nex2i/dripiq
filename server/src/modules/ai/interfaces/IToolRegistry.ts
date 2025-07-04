import { ITool, IToolResult, IToolDefinition } from './ITool';

export interface IToolRegistry {
  registerTool(tool: ITool): void;
  unregisterTool(name: string): void;
  getTool(name: string): ITool | undefined;
  getAllTools(): ITool[];
  getToolDefinitions(): IToolDefinition[];
  executeTool(name: string, args: any): Promise<IToolResult>;
}
