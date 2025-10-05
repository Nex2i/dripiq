import { ChatOpenAI, OpenAIClient } from '@langchain/openai';

export interface LangChainConfig {
  model: string;
  maxTokens?: number;
  maxIterations: number;
  timeout: number;
  reasoning: OpenAIClient.Reasoning;
}

const defaultLowReasoning: OpenAIClient.Reasoning = {
  effort: 'minimal',
  summary: 'concise',
};

export const defaultLangChainConfig: LangChainConfig = {
  model: 'gpt-5-mini',
  maxIterations: 20,
  timeout: 1000 * 60 * 2.5, // 2.5 minutes
  reasoning: defaultLowReasoning,
};

export const defaultLowIntelligenceLangchainConfig: LangChainConfig = {
  ...defaultLangChainConfig,
  model: 'gpt-5-nano',
  reasoning: defaultLowReasoning,
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
    reasoning: finalConfig.reasoning,
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
