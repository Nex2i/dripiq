import { ChatOpenAI } from '@langchain/openai';

export interface LangChainConfig {
  model: string;
  temperature: number;
  maxTokens?: number;
  maxIterations: number;
  timeout: number;
}

export const defaultLangChainConfig: LangChainConfig = {
  model: 'gpt-4.1-mini',
  temperature: 0.8,
  maxIterations: 10,
  timeout: 60000, // 60 seconds
};

export function createChatModel(config: Partial<LangChainConfig> = {}): ChatOpenAI {
  const finalConfig = { ...defaultLangChainConfig, ...config };
  
  return new ChatOpenAI({
    model: finalConfig.model,
    temperature: finalConfig.temperature,
    maxTokens: finalConfig.maxTokens,
    timeout: finalConfig.timeout,
    apiKey: process.env.OPENAI_API_KEY,
    // Configure to use OpenAI's Responses API for better tool calling and structured output
    // Note: This will be automatically enabled by LangChain when using compatible features
    // useResponsesApi: true,
    // Use the new response format for better content handling  
    // outputVersion: "responses/v1",
  });
}

export interface ReportConfig {
  maxIterations?: number;
  temperature?: number;
  enableWebSearch?: boolean;
  model?: string;
}

export function createReportConfig(overrides: ReportConfig = {}): LangChainConfig {
  return {
    ...defaultLangChainConfig,
    ...overrides,
  };
}
