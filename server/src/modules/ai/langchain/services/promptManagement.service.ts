import { logger } from '@/libs/logger';
import { getLangfuseClient } from '../config/langfuse.config';

export interface PromptFetchOptions {
  version?: number;
  label?: string;
  cacheTtlSeconds?: number;
}

export interface PromptCompileOptions {
  variables: Record<string, string>;
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

  /**
   * Fetches and compiles a prompt with variables
   * @param promptName - The name of the prompt in LangFuse
   * @param variables - Variables to inject into the prompt
   * @param options - Optional configuration for version, label, or cache TTL
   * @returns The compiled prompt string
   */
  async fetchAndCompilePrompt(
    promptName: string,
    variables: Record<string, string>,
    options: PromptFetchOptions = {}
  ): Promise<string> {
    try {
      const prompt = await this.fetchPrompt(promptName, options);

      // Compile the prompt with variables
      const compiledPrompt = prompt.compile(variables);

      logger.debug(`Compiled prompt '${promptName}' with variables`, {
        promptName,
        variableKeys: Object.keys(variables),
      });

      return compiledPrompt;
    } catch (error) {
      logger.error(`Failed to fetch and compile prompt '${promptName}' from LangFuse`, error);
      throw error;
    }
  }

  /**
   * Validates that all required variables are provided
   * @param promptName - The name of the prompt
   * @param variables - Variables to validate
   * @param requiredVars - List of required variable names
   */
  validateVariables(
    promptName: string,
    variables: Record<string, string>,
    requiredVars: string[]
  ): void {
    const missingVars = requiredVars.filter((varName) => !(varName in variables));

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required variables for prompt '${promptName}': ${missingVars.join(', ')}`
      );
    }
  }
}

export const promptManagementService = new PromptManagementService();
