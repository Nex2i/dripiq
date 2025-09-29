import { logger } from '@/libs/logger';
import { getLangfuseClient } from '../config/langfuse.config';

export interface PromptFetchOptions {
  version?: number;
  label?: string;
  cacheTtlSeconds?: number;
}

export class PromptManagementService {
  /**
   * Fetches a prompt from LangFuse by name
   * @param promptName - The name of the prompt in LangFuse
   * @param options - Optional configuration for version, label, or cache TTL
   * @returns The prompt object from LangFuse
   */
  async fetchPrompt(promptName: string, options: PromptFetchOptions = {}) {
    try {
      const langfuse = getLangfuseClient();

      const prompt = await langfuse.getPrompt(promptName, options.version, {
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
