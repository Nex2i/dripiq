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
  temperature: 0.1,
  maxTokens: 4000,
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