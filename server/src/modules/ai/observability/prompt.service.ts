import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '@/libs/logger';
import { promptHelper, PromptTypes } from '@/prompts/prompt.helper';
import { langfuseService } from './langfuse.service';

export interface PromptVersion {
  version: number;
  prompt: string;
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };
  isActive?: boolean;
  labels?: string[];
}

export interface PromptConfig {
  useRemote?: boolean;
  fallbackToLocal?: boolean;
  version?: number;
}

class PromptManagementService {
  private promptCache = new Map<string, { prompt: string; timestamp: number; config?: any }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get prompt from LangFuse or fallback to local
   */
  public async getPrompt(
    promptName: string,
    config: PromptConfig = {}
  ): Promise<{ prompt: string; promptConfig?: any }> {
    const { useRemote = true, fallbackToLocal = true, version } = config;

    if (useRemote && langfuseService.isReady()) {
      try {
        const remotePrompt = await this.getRemotePrompt(promptName, version);
        if (remotePrompt) {
          this.cachePrompt(promptName, remotePrompt.prompt, remotePrompt.config);
          return {
            prompt: remotePrompt.prompt,
            promptConfig: remotePrompt.config,
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch remote prompt, trying cache or fallback', {
          promptName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Try cache first
    const cached = this.getCachedPrompt(promptName);
    if (cached) {
      return { prompt: cached.prompt, promptConfig: cached.config };
    }

    // Fallback to local prompt
    if (fallbackToLocal) {
      const localPrompt = this.getLocalPrompt(promptName);
      if (localPrompt) {
        return { prompt: localPrompt };
      }
    }

    throw new Error(`Prompt '${promptName}' not found in remote, cache, or local sources`);
  }

  /**
   * Get prompt and create LangChain ChatPromptTemplate
   */
  public async getPromptTemplate(
    promptName: string,
    config: PromptConfig = {}
  ): Promise<ChatPromptTemplate> {
    const { prompt } = await this.getPrompt(promptName, config);
    return ChatPromptTemplate.fromTemplate(prompt);
  }

  /**
   * Create or update a prompt in LangFuse
   */
  public async createOrUpdatePrompt(
    name: string,
    prompt: string,
    config?: any,
    labels: string[] = ['production']
  ): Promise<boolean> {
    if (!langfuseService.isReady()) {
      logger.warn('LangFuse not ready, cannot create/update prompt');
      return false;
    }

    try {
      const client = langfuseService.getClient();
      if (!client) {
        return false;
      }

      await client.createPrompt({
        name,
        prompt,
        config: config || {
          model: 'gpt-4o-mini',
          temperature: 0,
        },
        labels,
      });

      logger.info('Successfully created/updated prompt in LangFuse', { name, labels });

      // Invalidate cache
      this.promptCache.delete(name);

      return true;
    } catch (error) {
      logger.error('Failed to create/update prompt in LangFuse', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Migrate local prompts to LangFuse
   */
  public async migrateLocalPromptsToLangFuse(): Promise<void> {
    if (!langfuseService.isReady()) {
      logger.warn('LangFuse not ready, skipping prompt migration');
      return;
    }

    logger.info('Starting migration of local prompts to LangFuse');

    const promptTypes: PromptTypes[] = [
      'summarize_site',
      'vendor_fit',
      'smart_filter_site',
      'contact_strategy',
    ];

    const migrationResults = await Promise.allSettled(
      promptTypes.map(async (promptType) => {
        try {
          const localPrompt = this.getLocalPrompt(promptType);
          if (localPrompt) {
            const success = await this.createOrUpdatePrompt(
              promptType,
              localPrompt,
              {
                model: 'gpt-4o-mini',
                temperature: 0,
                maxTokens: 4000,
              },
              ['production', 'migrated']
            );

            if (success) {
              logger.info(`Successfully migrated prompt: ${promptType}`);
            } else {
              logger.warn(`Failed to migrate prompt: ${promptType}`);
            }

            return { promptType, success };
          } else {
            logger.warn(`Local prompt not found: ${promptType}`);
            return { promptType, success: false };
          }
        } catch (error) {
          logger.error(`Error migrating prompt: ${promptType}`, error);
          return { promptType, success: false, error };
        }
      })
    );

    const successful = migrationResults.filter(
      (result) => result.status === 'fulfilled' && result.value.success
    ).length;

    logger.info(`Prompt migration completed: ${successful}/${promptTypes.length} successful`);
  }

  /**
   * Get prompt versions from LangFuse
   */
  public async getPromptVersions(promptName: string): Promise<PromptVersion[]> {
    if (!langfuseService.isReady()) {
      return [];
    }

    try {
      const client = langfuseService.getClient();
      if (!client) {
        return [];
      }

      // Note: This would need to be implemented based on LangFuse API
      // For now, we'll return empty array as this is an advanced feature
      logger.info('Prompt versioning would be implemented here', { promptName });
      return [];
    } catch (error) {
      logger.error('Failed to get prompt versions', { promptName, error });
      return [];
    }
  }

  private async getRemotePrompt(
    promptName: string,
    version?: number
  ): Promise<{ prompt: string; config?: any } | null> {
    const client = langfuseService.getClient();
    if (!client) {
      return null;
    }

    try {
      const promptData = await client.getPrompt(promptName, version);

      if (promptData && promptData.prompt) {
        return {
          prompt: promptData.prompt,
          config: promptData.config,
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to fetch remote prompt', { promptName, version, error });
      return null;
    }
  }

  private getLocalPrompt(promptName: string): string | null {
    try {
      return promptHelper.getPromptAndInject(promptName as PromptTypes, {});
    } catch (error) {
      logger.warn('Local prompt not found', { promptName, error });
      return null;
    }
  }

  private cachePrompt(promptName: string, prompt: string, config?: any): void {
    this.promptCache.set(promptName, {
      prompt,
      config,
      timestamp: Date.now(),
    });
  }

  private getCachedPrompt(promptName: string): { prompt: string; config?: any } | null {
    const cached = this.promptCache.get(promptName);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return { prompt: cached.prompt, config: cached.config };
    }

    if (cached) {
      this.promptCache.delete(promptName);
    }

    return null;
  }

  /**
   * Clear prompt cache
   */
  public clearCache(): void {
    this.promptCache.clear();
    logger.info('Prompt cache cleared');
  }
}

// Export singleton instance
export const promptService = new PromptManagementService();
