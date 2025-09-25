import { logger } from '@/libs/logger';
import { langfuseService } from './langfuse.service';

export interface PromptOptions {
  cacheTtlSeconds?: number;
  variables?: Record<string, any>;
  environment?: 'local' | 'prod';
}

export interface PromptResult {
  prompt: string;
  version?: number;
  metadata?: Record<string, any>;
  cached?: boolean;
}

interface CachedPrompt {
  prompt: string;
  version?: number;
  metadata?: Record<string, any>;
  timestamp: number;
  ttl: number;
}

export class PromptService {
  private cache = new Map<string, CachedPrompt>();
  private defaultCacheTtl = 300; // 5 minutes
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await langfuseService.waitForInitialization();
      this.isInitialized = true;
      logger.info('PromptService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PromptService', error);
      this.isInitialized = true; // Mark as initialized even on error to prevent blocking
    }
  }

  /**
   * Wait for initialization to complete
   */
  public async waitForInitialization(): Promise<void> {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Get a prompt from LangFuse with intelligent caching
   */
  public async getPrompt(
    promptName: string, 
    options: PromptOptions = {}
  ): Promise<PromptResult> {
    await this.waitForInitialization();

    const environment = options.environment || this.getEnvironment();
    const cacheKey = `${promptName}_${environment}`;
    const cacheTtl = (options.cacheTtlSeconds || this.defaultCacheTtl) * 1000;

    // Check cache first
    const cached = this.getCachedPrompt(cacheKey, cacheTtl);
    if (cached) {
      logger.debug('Prompt retrieved from cache', { 
        promptName, 
        environment,
        version: cached.version,
        cacheAge: Date.now() - cached.timestamp 
      });

      return {
        prompt: cached.prompt,
        version: cached.version,
        metadata: cached.metadata,
        cached: true,
      };
    }

    // Fetch from LangFuse
    try {
      const promptData = await this.fetchPromptFromLangFuse(promptName, environment);
      
      // Cache the result
      this.cachePrompt(cacheKey, promptData, cacheTtl);

      logger.info('Prompt retrieved from LangFuse', { 
        promptName, 
        environment,
        version: promptData.version,
        length: promptData.prompt.length 
      });

      return {
        ...promptData,
        cached: false,
      };
    } catch (error) {
      logger.error('Failed to fetch prompt from LangFuse', { 
        promptName, 
        environment, 
        error 
      });

      // If we have a stale cached version, use it as fallback
      const staleCache = this.cache.get(cacheKey);
      if (staleCache) {
        logger.warn('Using stale cached prompt as fallback', { 
          promptName, 
          environment,
          cacheAge: Date.now() - staleCache.timestamp 
        });

        return {
          prompt: staleCache.prompt,
          version: staleCache.version,
          metadata: { 
            ...staleCache.metadata, 
            fallbackUsed: true,
            originalError: error instanceof Error ? error.message : 'Unknown error'
          },
          cached: true,
        };
      }

      throw new Error(`Failed to retrieve prompt '${promptName}' for environment '${environment}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Inject variables into a prompt template
   */
  public injectVariables(
    promptTemplate: string, 
    variables: Record<string, any>
  ): string {
    if (!variables || Object.keys(variables).length === 0) {
      return promptTemplate;
    }

    let result = promptTemplate;

    // Find all {{variable}} patterns
    const variableMatches = promptTemplate.match(/{{(.*?)}}/g);
    
    if (variableMatches) {
      // Validate that all required variables are provided
      const missingVariables: string[] = [];
      
      variableMatches.forEach((match) => {
        const variableName = match.slice(2, -2).trim(); // Remove {{ and }}
        if (!(variableName in variables)) {
          missingVariables.push(variableName);
        }
      });

      if (missingVariables.length > 0) {
        logger.warn('Missing variables for prompt injection', { 
          missingVariables,
          providedVariables: Object.keys(variables) 
        });
      }

      // Replace variables
      result = result.replace(/{{(.*?)}}/g, (match, variableName) => {
        const trimmedName = variableName.trim();
        if (trimmedName in variables) {
          const value = variables[trimmedName];
          // Handle different types of values
          if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
          }
          return String(value);
        }
        // Return the original placeholder if variable not found
        return match;
      });
    }

    logger.debug('Variables injected into prompt', { 
      originalLength: promptTemplate.length,
      finalLength: result.length,
      variableCount: Object.keys(variables).length 
    });

    return result;
  }

  /**
   * Get prompt with variables injected
   */
  public async getPromptWithVariables(
    promptName: string,
    variables: Record<string, any>,
    options: Omit<PromptOptions, 'variables'> = {}
  ): Promise<PromptResult> {
    const promptResult = await this.getPrompt(promptName, options);
    
    const injectedPrompt = this.injectVariables(promptResult.prompt, variables);
    
    return {
      ...promptResult,
      prompt: injectedPrompt,
      metadata: {
        ...promptResult.metadata,
        variablesInjected: Object.keys(variables),
        injectedVariableCount: Object.keys(variables).length,
      },
    };
  }

  /**
   * Clear cached prompts
   */
  public clearCache(promptName?: string, environment?: string): void {
    if (promptName && environment) {
      const cacheKey = `${promptName}_${environment}`;
      this.cache.delete(cacheKey);
      logger.debug('Cleared specific prompt from cache', { promptName, environment });
    } else if (promptName) {
      // Clear all environments for this prompt
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(`${promptName}_`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.debug('Cleared all environments for prompt from cache', { promptName, count: keysToDelete.length });
    } else {
      // Clear entire cache
      const cacheSize = this.cache.size;
      this.cache.clear();
      logger.debug('Cleared entire prompt cache', { clearedCount: cacheSize });
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    entries: Array<{
      key: string;
      age: number;
      ttl: number;
      expired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, cached]) => ({
      key,
      age: now - cached.timestamp,
      ttl: cached.ttl,
      expired: now > cached.timestamp + cached.ttl,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Determine the current environment
   */
  private getEnvironment(): 'local' | 'prod' {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    return nodeEnv === 'production' || nodeEnv === 'prod' ? 'prod' : 'local';
  }

  /**
   * Get cached prompt if valid
   */
  private getCachedPrompt(cacheKey: string, cacheTtl: number): CachedPrompt | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now > cached.timestamp + cacheTtl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache a prompt
   */
  private cachePrompt(cacheKey: string, promptData: PromptResult, ttl: number): void {
    this.cache.set(cacheKey, {
      prompt: promptData.prompt,
      version: promptData.version,
      metadata: promptData.metadata,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Fetch prompt from LangFuse
   */
  private async fetchPromptFromLangFuse(
    promptName: string, 
    environment: string
  ): Promise<PromptResult> {
    if (!langfuseService.isAvailable()) {
      throw new Error('LangFuse service is not available');
    }

    try {
      // Use LangFuse SDK to fetch prompt
      // Note: This is a simplified implementation - the actual LangFuse SDK method might differ
      const langfuse = (langfuseService as any).client;
      if (!langfuse) {
        throw new Error('LangFuse client not initialized');
      }

      // Fetch the prompt (environment-specific)
      const promptData = await langfuse.getPrompt(promptName, {
        environment,
      });

      if (!promptData) {
        throw new Error(`Prompt '${promptName}' not found in environment '${environment}'`);
      }

      return {
        prompt: promptData.prompt || promptData.content || '',
        version: promptData.version,
        metadata: {
          environment,
          promptName,
          fetchedAt: new Date().toISOString(),
          ...promptData.metadata,
        },
      };
    } catch (error) {
      logger.error('LangFuse prompt fetch failed', { 
        promptName, 
        environment, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
}

// Singleton instance
export const promptService = new PromptService();