import { ChatOpenAI } from '@langchain/openai';

export interface LangChainConfig {
  model: string;
  maxTokens?: number;
  maxIterations: number;
  timeout: number;
}

export const defaultLangChainConfig: LangChainConfig = {
  model: 'gpt-5-mini',
  maxIterations: 20,
  timeout: 60000, // 60 seconds
};

export const defaultLowIntelligenceLangchainConfig: LangChainConfig = {
  ...defaultLangChainConfig,
  model: 'gpt-5-nano',
  timeout: 120000, // 120 seconds for smart URL filtering (handles large sitemaps)
};

export function createChatModel(config: Partial<LangChainConfig> = {}): ChatOpenAI {
  const finalConfig = { ...defaultLangChainConfig, ...config };

  return new ChatOpenAI({
    model: finalConfig.model,
    maxTokens: finalConfig.maxTokens,
    timeout: finalConfig.timeout,
    apiKey: process.env.OPENAI_API_KEY,
    // Configure to use OpenAI's Responses API for better tool calling and structured output
    useResponsesApi: true,
  });
}

export interface ReportConfig {
  maxIterations?: number;
  enableWebSearch?: boolean;
  model?: string;
}

export function createReportConfig(overrides: ReportConfig = {}): LangChainConfig {
  return {
    ...defaultLangChainConfig,
    ...overrides,
  } as LangChainConfig;
}
