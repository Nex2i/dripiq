import { ChatPromptClient, LangfuseClient } from '@langfuse/client';

import { logger } from '@/libs/logger';
import { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST } from '@/config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Trace } from '@langfuse/core';

export interface PromptFetchOptions {
  version?: number;
  label?: string;
  cacheTtlSeconds?: number;
}

export class PromptManagementService {
  private langfuseClient: LangfuseClient;

  constructor() {
    if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
      throw new Error(
        'LangFuse credentials not configured. Please set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables.'
      );
    }

    this.langfuseClient = new LangfuseClient({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });

    logger.info('LangFuse prompt management service initialized (v4 SDK)');
  }

  /**
   * Fetches a prompt from LangFuse by name using the v4 SDK
   * @param promptName - The name of the prompt in LangFuse
   * @param options - Optional configuration for version, label, or cache TTL
   * @returns The prompt object from LangFuse
   */
  async toLangChainPrompt(prompt: ChatPromptClient): Promise<ChatPromptTemplate<any, any>> {
    try {
      // Create prompt template with compiled content
      const langChainPrompt = ChatPromptTemplate.fromMessages(
        prompt.getLangchainPrompt().concat(['placeholder', '{agent_scratchpad}'])
      );
      return langChainPrompt;
    } catch (error) {
      logger.error(`Failed to convert prompt to LangChain format`, error);
      throw error;
    }
  }

  async fetchPrompt(
    promptName: string,
    options: PromptFetchOptions = {}
  ): Promise<ChatPromptClient> {
    try {
      const prompt = await this.langfuseClient.prompt.get(promptName, {
        version: options.version,
        label: options.label,
        cacheTtlSeconds: options.cacheTtlSeconds,
        type: 'chat',
      });

      if (!prompt) {
        throw new Error(`Prompt '${promptName}' not found in LangFuse`);
      }

      return prompt;
    } catch (error) {
      logger.error(`Failed to fetch prompt '${promptName}' from LangFuse`, error);
      throw error;
    }
  }
}

export const promptManagementService = new PromptManagementService();
