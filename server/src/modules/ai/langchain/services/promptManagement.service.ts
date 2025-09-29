import { Langfuse } from 'langfuse';
import { logger } from '@/libs/logger';
import { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST } from '@/config';

export interface PromptFetchOptions {
  version?: number;
  label?: string;
  cacheTtlSeconds?: number;
}

export class PromptManagementService {
  private langfuse: Langfuse;

  constructor() {
    if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
      throw new Error(
        'LangFuse credentials not configured. Please set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables.'
      );
    }

    this.langfuse = new Langfuse({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });

    logger.info('LangFuse prompt management service initialized');
  }

  /**
   * Fetches a prompt from LangFuse by name
   * @param promptName - The name of the prompt in LangFuse
   * @param options - Optional configuration for version, label, or cache TTL
   * @returns The prompt object from LangFuse
   */
  async fetchPrompt(promptName: string, options: PromptFetchOptions = {}) {
    try {
      const prompt = await this.langfuse.getPrompt(promptName, options.version, {
        label: options.label,
        cacheTtlSeconds: options.cacheTtlSeconds,
      });

      if (!prompt) {
        throw new Error(`Prompt '${promptName}' not found in LangFuse`);
      }

      logger.info(`Successfully fetched prompt '${promptName}' from LangFuse`, {
        promptName,
        version: prompt.version,
      });

      return prompt;
    } catch (error) {
      logger.error(`Failed to fetch prompt '${promptName}' from LangFuse`, error);
      throw error;
    }
  }
}

export const promptManagementService = new PromptManagementService();