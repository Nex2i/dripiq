import { OpenAIClient } from '../implementations/OpenAIClient';
import { ToolRegistry } from '../implementations/ToolRegistry';
import { ITool } from '../interfaces/ITool';
import { IAIClient } from '../interfaces/IAIClient';
import { IToolRegistry } from '../interfaces/IToolRegistry';

// Import concrete tool implementations
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';

// Constants for model names
export const AI_MODELS = {
  GPT_4_1: 'gpt-4.1',
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

// Error result interface for consistent error handling
export interface ErrorResult {
  success: false;
  error: string;
  details?: any;
}

export interface SuccessResult<T = any> {
  success: true;
  data: T;
}

export type ServiceResult<T = any> = SuccessResult<T> | ErrorResult;

// Tool execution result types
export interface ToolExecutionResult {
  toolCallId: string;
  result: string;
}

export interface FunctionCallRecord {
  functionName: string;
  arguments: any;
  result: any;
}

/**
 * Creates an AI client and tool registry with the specified tools
 * This centralizes the setup logic that was duplicated across factories
 */
export function createAIClientAndToolRegistry(tools: ITool[]): {
  aiClient: IAIClient;
  toolRegistry: IToolRegistry;
} {
  // Create AI client
  const aiClient = new OpenAIClient();

  // Create tool registry
  const toolRegistry = new ToolRegistry();

  // Register provided tools
  tools.forEach((tool) => toolRegistry.registerTool(tool));

  return { aiClient, toolRegistry };
}

/**
 * Gets the default tools used by report services
 */
export function getDefaultTools(): ITool[] {
  return [
    new GetInformationAboutDomainTool(),
    new ListDomainPagesTool(),
    new RetrieveFullPageTool(),
  ];
}
