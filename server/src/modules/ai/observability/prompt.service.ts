import { ChatPromptTemplate } from '@langchain/core/prompts';
import { langfuseService } from './langfuse.service';
import { logger } from '@/libs/logger';

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
  version?: number;
  cacheTtlSeconds?: number;
}

class PromptManagementService {
  private promptCache = new Map<string, { prompt: string; timestamp: number; config?: any }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get prompt from LangFuse with caching
   */
  public async getPrompt(
    promptName: string,
    config: PromptConfig = {}
  ): Promise<{ prompt: string; promptConfig?: any }> {
    const { version, cacheTtlSeconds } = config;

    // Override cache TTL if specified
    const cacheKey = version ? `${promptName}:${version}` : promptName;
    const customTtl = cacheTtlSeconds ? cacheTtlSeconds * 1000 : this.CACHE_TTL;

    // Check cache first
    const cached = this.getCachedPrompt(cacheKey, customTtl);
    if (cached) {
      logger.debug('Retrieved prompt from cache', { promptName, version, cacheKey });
      return { prompt: cached.prompt, promptConfig: cached.config };
    }

    // Ensure LangFuse is ready
    if (!langfuseService.isReady()) {
      throw new Error('LangFuse service is not ready. Please check your configuration.');
    }

    try {
      const remotePrompt = await this.getRemotePrompt(promptName, version);
      if (remotePrompt) {
        this.cachePrompt(cacheKey, remotePrompt.prompt, remotePrompt.config);
        logger.debug('Retrieved and cached prompt from LangFuse', { promptName, version });
        return {
          prompt: remotePrompt.prompt,
          promptConfig: remotePrompt.config,
        };
      }

      throw new Error(`Prompt '${promptName}' not found in LangFuse`);
    } catch (error) {
      logger.error('Failed to fetch prompt from LangFuse', {
        promptName,
        version,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
      throw new Error('LangFuse service is not ready. Cannot create/update prompt.');
    }

    try {
      const client = langfuseService.getClient();
      if (!client) {
        throw new Error('LangFuse client is not available');
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

      // Invalidate related cache entries
      this.invalidatePromptCache(name);

      return true;
    } catch (error) {
      logger.error('Failed to create/update prompt in LangFuse', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get prompt versions from LangFuse
   */
  public async getPromptVersions(promptName: string): Promise<PromptVersion[]> {
    if (!langfuseService.isReady()) {
      throw new Error('LangFuse service is not ready');
    }

    try {
      const client = langfuseService.getClient();
      if (!client) {
        throw new Error('LangFuse client is not available');
      }

      // Note: This would need to be implemented based on LangFuse API
      // For now, we'll return empty array as this is an advanced feature
      logger.info('Prompt versioning would be implemented here', { promptName });
      return [];
    } catch (error) {
      logger.error('Failed to get prompt versions', { promptName, error });
      throw error;
    }
  }

  /**
   * Inject variables into prompt template
   */
  public injectVariables(prompt: string, variables: Record<string, string>): string {
    return prompt.replace(/\{\{(\w+)\}\}/g, (match: string, variableName: string): string => {
      if (variableName in variables && variables[variableName] !== undefined) {
        return variables[variableName];
      }
      logger.warn(`Variable ${variableName} not found in prompt variables`, { 
        prompt: prompt.substring(0, 100) + '...', 
        availableVars: Object.keys(variables) 
      });
      return match; // Keep the placeholder if variable not found
    });
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
      throw error;
    }
  }

  private cachePrompt(cacheKey: string, prompt: string, config?: any): void {
    this.promptCache.set(cacheKey, {
      prompt,
      config,
      timestamp: Date.now(),
    });
  }

  private getCachedPrompt(cacheKey: string, ttl: number = this.CACHE_TTL): { prompt: string; config?: any } | null {
    const cached = this.promptCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return { prompt: cached.prompt, config: cached.config };
    }

    if (cached) {
      this.promptCache.delete(cacheKey);
    }

    return null;
  }

  private invalidatePromptCache(promptName: string): void {
    // Remove all cached versions of this prompt
    const keysToDelete = Array.from(this.promptCache.keys()).filter(key => 
      key === promptName || key.startsWith(`${promptName}:`)
    );
    
    keysToDelete.forEach(key => this.promptCache.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.debug('Invalidated prompt cache entries', { promptName, keysRemoved: keysToDelete });
    }
  }

  /**
   * Clear all cached prompts
   */
  public clearCache(): void {
    this.promptCache.clear();
    logger.info('Prompt cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.promptCache.size,
      keys: Array.from(this.promptCache.keys()),
    };
  }
}

// Export singleton instance
export const promptService = new PromptManagementService();