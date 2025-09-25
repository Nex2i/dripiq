import { ChatOpenAI } from '@langchain/openai';
import { logger } from '@/libs/logger';
import { langfuseService, TracingMetadata } from '../../observability/langfuse.service';

export interface LangChainConfig {
  model: string;
  maxTokens?: number;
  maxIterations: number;
  timeout: number;
  temperature?: number;
  enableTracing?: boolean;
  tracingMetadata?: TracingMetadata;
}

export const defaultLangChainConfig: LangChainConfig = {
  model: 'gpt-4o-mini', // Fixed typo: was 'gpt-5-mini'
  maxIterations: 20,
  timeout: 60000, // 60 seconds
  temperature: 0,
  enableTracing: true,
};

export interface ChatModelOptions extends Partial<LangChainConfig> {
  callbacks?: any[];
  tracingMetadata?: TracingMetadata;
}

export function createChatModel(options: ChatModelOptions = {}): ChatOpenAI {
  const config = { ...defaultLangChainConfig, ...options };

  // Prepare callbacks array
  const callbacks: any[] = options.callbacks || [];

  // Add LangFuse callback if tracing is enabled
  if (config.enableTracing && langfuseService.isReady()) {
    try {
      const langfuseCallback = langfuseService.getCallbackHandler(
        options.tracingMetadata || config.tracingMetadata
      );

      if (langfuseCallback) {
        callbacks.push(langfuseCallback);
        logger.debug('LangFuse tracing enabled for chat model', {
          model: config.model,
          metadata: options.tracingMetadata,
        });
      }
    } catch (error) {
      logger.warn('Failed to add LangFuse callback to chat model', error);
    }
  }

  const chatModel = new ChatOpenAI({
    model: config.model,
    maxTokens: config.maxTokens,
    timeout: config.timeout,
    temperature: config.temperature,
    apiKey: process.env.OPENAI_API_KEY,
    // Configure to use OpenAI's Responses API for better tool calling and structured output
    useResponsesApi: true,
  });

  // Note: For now, we don't bind callbacks directly due to type issues
  // The callbacks are handled at the agent level instead
  return chatModel;
}

export function createInstrumentedChatModel(
  agentType: string,
  metadata: Omit<TracingMetadata, 'agentType'> = {},
  config: Partial<LangChainConfig> = {}
): ChatOpenAI {
  const tracingMetadata: TracingMetadata = {
    ...metadata,
    agentType,
    sessionId: metadata.sessionId || `${agentType}_${Date.now()}`,
  };

  return createChatModel({
    ...config,
    enableTracing: true,
    tracingMetadata,
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
