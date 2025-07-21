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
  maxIterations: 20,
  timeout: 60000, // 60 seconds
};

// Model fallback hierarchy: try mini first, then full model
const MODEL_FALLBACKS = ['gpt-4.1-mini', 'gpt-4.1'];

/**
 * Creates a ChatOpenAI model with automatic fallback support.
 * This class wraps the original ChatOpenAI and implements fallback logic.
 */
class ChatOpenAIWithFallback extends ChatOpenAI {
  private fallbackModels: string[];
  private currentModelIndex = 0;
  private originalConfig: any;

  constructor(config: any) {
    super(config);
    this.originalConfig = { ...config };
    this.fallbackModels = config.fallbackModels || MODEL_FALLBACKS;
  }

  async invoke(input: any, options?: any): Promise<any> {
    for (let i = this.currentModelIndex; i < this.fallbackModels.length; i++) {
      try {
        // Update the model name for this attempt
        this.model = this.fallbackModels[i];
        
        if (i > this.currentModelIndex) {
          console.log(`[LangChain] Trying fallback model: ${this.model}`);
        } else if (i === 0) {
          console.log(`[LangChain] Using primary model: ${this.model}`);
        }
        
        const result = await super.invoke(input, options);
        
        // If successful, remember this model for future calls
        if (i > this.currentModelIndex) {
          console.log(`[LangChain] Successfully using fallback model: ${this.model}`);
          this.currentModelIndex = i;
        }
        
        return result;
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        // Check if it's a model not found error (404) or other model availability issues
        if (errorMessage.includes('404') || 
            errorMessage.includes('Model not found') || 
            errorMessage.includes('model_not_found') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('invalid_request_error') ||
            error?.status === 404 ||
            error?.code === 'model_not_found') {
          console.warn(`[LangChain] Model ${this.fallbackModels[i]} not available (404), trying next fallback...`);
          
          // If this is the last model, throw the error
          if (i === this.fallbackModels.length - 1) {
            throw new Error(`[LangChain] All fallback models failed: ${this.fallbackModels.join(', ')}. Last error: ${errorMessage}`);
          }
          
          continue; // Try next model
        }
        
        // If it's not a model availability issue, don't try fallbacks
        console.error(`[LangChain] Error with model ${this.fallbackModels[i]} (not a 404):`, errorMessage);
        throw error;
      }
    }
  }

  async stream(input: any, options?: any): Promise<any> {
    // For streaming, we'll use the same fallback logic
    for (let i = this.currentModelIndex; i < this.fallbackModels.length; i++) {
      try {
        this.model = this.fallbackModels[i];
        
        if (i > this.currentModelIndex) {
          console.log(`[LangChain] Trying fallback model for streaming: ${this.model}`);
        }
        
        const result = await super.stream(input, options);
        
        if (i > this.currentModelIndex) {
          console.log(`[LangChain] Successfully using fallback model for streaming: ${this.model}`);
          this.currentModelIndex = i;
        }
        
        return result;
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        if (errorMessage.includes('404') || 
            errorMessage.includes('Model not found') || 
            errorMessage.includes('model_not_found') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('invalid_request_error') ||
            error?.status === 404 ||
            error?.code === 'model_not_found') {
          console.warn(`[LangChain] Model ${this.fallbackModels[i]} not available for streaming (404), trying next fallback...`);
          
          if (i === this.fallbackModels.length - 1) {
            throw new Error(`[LangChain] All fallback models failed for streaming: ${this.fallbackModels.join(', ')}. Last error: ${errorMessage}`);
          }
          
          continue;
        }
        
        console.error(`[LangChain] Error with model ${this.fallbackModels[i]} for streaming (not a 404):`, errorMessage);
        throw error;
      }
    }
  }

  async call(messages: any, options?: any): Promise<any> {
    // Legacy method support with fallback
    for (let i = this.currentModelIndex; i < this.fallbackModels.length; i++) {
      try {
        this.model = this.fallbackModels[i];
        
        if (i > this.currentModelIndex) {
          console.log(`[LangChain] Trying fallback model for call: ${this.model}`);
        }
        
        const result = await super.call(messages, options);
        
        if (i > this.currentModelIndex) {
          console.log(`[LangChain] Successfully using fallback model for call: ${this.model}`);
          this.currentModelIndex = i;
        }
        
        return result;
      } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        if (errorMessage.includes('404') || 
            errorMessage.includes('Model not found') || 
            errorMessage.includes('model_not_found') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('invalid_request_error') ||
            error?.status === 404 ||
            error?.code === 'model_not_found') {
          console.warn(`[LangChain] Model ${this.fallbackModels[i]} not available for call (404), trying next fallback...`);
          
          if (i === this.fallbackModels.length - 1) {
            throw new Error(`[LangChain] All fallback models failed for call: ${this.fallbackModels.join(', ')}. Last error: ${errorMessage}`);
          }
          
          continue;
        }
        
        console.error(`[LangChain] Error with model ${this.fallbackModels[i]} for call (not a 404):`, errorMessage);
        throw error;
      }
    }
  }
}

export function createChatModel(config: Partial<LangChainConfig> = {}): ChatOpenAI {
  const finalConfig = { ...defaultLangChainConfig, ...config };

  return new ChatOpenAIWithFallback({
    model: finalConfig.model,
    temperature: finalConfig.temperature,
    maxTokens: finalConfig.maxTokens,
    timeout: finalConfig.timeout,
    apiKey: process.env.OPENAI_API_KEY,
    // Configure to use OpenAI's Responses API for better tool calling and structured output
    useResponsesApi: true,
    // Pass the fallback models
    fallbackModels: MODEL_FALLBACKS,
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
