import { logger } from '@/libs/logger';
import { LangFuseService } from './langfuse.service';

export interface PromptResult {
  prompt: string;
  version?: string;
  metadata?: Record<string, any>;
}

export type PromptName = 'summarize_site' | 'vendor_fit' | 'extract_contacts' | 'contact_strategy';

/**
 * Prompt Service - LangFuse-first prompt management
 *
 * Features:
 * - Direct LangFuse prompt retrieval (no caching)
 * - Always uses latest production prompt version
 * - Built-in variable injection system with {{variable}} syntax
 * - Comprehensive error handling and logging
 */
export class PromptService {
  private langfuseService: LangFuseService;

  constructor(langfuseService: LangFuseService) {
    this.langfuseService = langfuseService;
  }

  /**
   * Retrieve a prompt from LangFuse (always fresh, no caching)
   */
  public async getPrompt(name: PromptName): Promise<PromptResult> {
    // Require LangFuse to be available
    if (!this.langfuseService.isAvailable()) {
      const errorMessage = 'LangFuse is not available';
      logger.error(errorMessage, { name });
      throw new Error(`${errorMessage} for prompt: ${name}`);
    }

    try {
      const promptResult = await this.fetchPromptFromLangFuse(name);

      logger.info('Prompt retrieved from LangFuse', {
        name,
        version: promptResult.version,
      });

      return promptResult;
    } catch (error) {
      logger.error('Failed to retrieve prompt from LangFuse', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(
        `Failed to retrieve prompt '${name}' from LangFuse: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Inject variables into a prompt template using {{variable}} syntax
   */
  public injectVariables(template: string, variables: Record<string, string>): string {
    // Find all variables in the template
    const variableMatches = template.match(/{{(.*?)}}/g);

    if (!variableMatches) {
      return template;
    }

    // Validate that all required variables are provided
    const missingVariables: string[] = [];
    for (const match of variableMatches) {
      const variableName = match.slice(2, -2).trim(); // Remove {{ and }}
      if (!(variableName in variables)) {
        missingVariables.push(variableName);
      }
    }

    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required variables for prompt injection: ${missingVariables.join(', ')}`
      );
    }

    // Replace all variables
    let result = template;
    for (const match of variableMatches) {
      const variableName = match.slice(2, -2).trim();
      const value = variables[variableName];
      if (value !== undefined) {
        result = result.replace(new RegExp(match.replace(/[{}]/g, '\\$&'), 'g'), value);
      }
    }

    logger.debug('Variables injected into prompt', {
      variableCount: Object.keys(variables).length,
      variables: Object.keys(variables),
    });

    return result;
  }

  /**
   * Retrieve a prompt and inject variables in one operation
   */
  public async getPromptWithVariables(
    name: PromptName,
    variables: Record<string, string>
  ): Promise<PromptResult> {
    const promptResult = await this.getPrompt(name);
    const injectedPrompt = this.injectVariables(promptResult.prompt, variables);

    return {
      ...promptResult,
      prompt: injectedPrompt,
    };
  }

  /**
   * Fetch prompt from LangFuse using the official SDK
   */
  private async fetchPromptFromLangFuse(name: PromptName): Promise<PromptResult> {
    try {
      // Get the LangFuse client from the service
      const client = this.langfuseService.getClient();

      if (!client) {
        throw new Error('LangFuse client not available');
      }

      // Fetch the prompt using LangFuse SDK
      // According to docs: langfuse.prompt.get("prompt-name")
      const langfusePrompt = await client.prompt.get(name);

      if (!langfusePrompt) {
        throw new Error(`Prompt '${name}' not found in LangFuse`);
      }

      // For chat prompts, we need to extract the system message content
      let promptContent: string;

      if (langfusePrompt.type === 'chat') {
        // Chat prompt - extract system message content
        const messages = langfusePrompt.prompt;
        if (Array.isArray(messages)) {
          const systemMessage = messages.find((msg: any) => msg.role === 'system');
          if (systemMessage && systemMessage.content) {
            promptContent = systemMessage.content;
          } else {
            throw new Error(`No system message found in chat prompt '${name}'`);
          }
        } else {
          throw new Error(`Invalid chat prompt format for '${name}'`);
        }
      } else if (langfusePrompt.type === 'text') {
        // Text prompt - use directly
        promptContent = langfusePrompt.prompt;
      } else {
        throw new Error(`Unsupported prompt type '${langfusePrompt.type}' for prompt '${name}'`);
      }

      logger.debug('LangFuse prompt fetched successfully', {
        name,
        type: langfusePrompt.type,
        version: langfusePrompt.version,
        promptLength: promptContent.length,
      });

      return {
        prompt: promptContent,
        version: langfusePrompt.version?.toString(),
        metadata: {
          type: langfusePrompt.type,
          langfuseId: langfusePrompt.id,
          config: langfusePrompt.config,
          labels: langfusePrompt.labels,
        },
      };
    } catch (error) {
      logger.error('Failed to fetch prompt from LangFuse', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(
        `Failed to fetch prompt '${name}' from LangFuse: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Please ensure the prompt exists in your LangFuse dashboard.`
      );
    }
  }
}

// Factory function for creating prompt service
export const createPromptService = (langfuseService: LangFuseService): PromptService => {
  return new PromptService(langfuseService);
};
