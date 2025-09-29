import { LangFuseService } from './langfuse.service';
import { logger } from '@/libs/logger';

export interface PromptConfig {
  cacheTtlSeconds?: number;
}

export interface PromptResult {
  prompt: string;
  version?: string;
  metadata?: Record<string, any>;
  cached?: boolean;
}

export interface PromptCache {
  prompt: string;
  version?: string;
  metadata?: Record<string, any>;
  cachedAt: number;
  expiresAt: number;
}

export type PromptName = 
  | 'summarize_site'
  | 'vendor_fit'
  | 'extract_contacts'
  | 'contact_strategy';

/**
 * Prompt Service - LangFuse-first prompt management with intelligent caching
 * 
 * Features:
 * - LangFuse-first prompt retrieval (no local fallbacks)
 * - Environment-based prompt selection (local vs prod)
 * - Built-in variable injection system with {{variable}} syntax
 * - Intelligent caching with configurable TTL
 * - Comprehensive error handling and logging
 */
export class PromptService {
  private langfuseService: LangFuseService;
  private cache: Map<string, PromptCache> = new Map();
  private defaultCacheTtlSeconds: number = 300; // 5 minutes default
  private environment: string;

  constructor(langfuseService: LangFuseService) {
    this.langfuseService = langfuseService;
    this.environment = process.env.NODE_ENV || 'local';
  }

  /**
   * Retrieve a prompt from LangFuse with optional caching
   */
  public async getPrompt(
    name: PromptName,
    config?: PromptConfig
  ): Promise<PromptResult> {
    const cacheKey = this.getCacheKey(name, this.environment);
    const cacheTtl = config?.cacheTtlSeconds || this.defaultCacheTtlSeconds;

    // Check cache first
    const cached = this.getCachedPrompt(cacheKey);
    if (cached) {
      logger.debug('Prompt retrieved from cache', { 
        name, 
        environment: this.environment,
        version: cached.version 
      });
      return {
        prompt: cached.prompt,
        version: cached.version,
        metadata: cached.metadata,
        cached: true,
      };
    }

    // Fetch from LangFuse
    if (!this.langfuseService.isAvailable()) {
      const errorMessage = 'LangFuse is not available and no cached prompt found';
      logger.error(errorMessage, { name, environment: this.environment });
      throw new Error(`${errorMessage} for prompt: ${name}`);
    }

    try {
      const promptResult = await this.fetchPromptFromLangFuse(name);
      
      // Cache the result
      this.cachePrompt(cacheKey, promptResult, cacheTtl);
      
      logger.info('Prompt retrieved from LangFuse', { 
        name, 
        environment: this.environment,
        version: promptResult.version,
        cached: false 
      });

      return {
        ...promptResult,
        cached: false,
      };
    } catch (error) {
      logger.error('Failed to retrieve prompt from LangFuse', { 
        name, 
        environment: this.environment,
        error: error instanceof Error ? error.message : 'Unknown error'
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
  public injectVariables(
    template: string,
    variables: Record<string, string>
  ): string {
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
      result = result.replace(new RegExp(match.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    logger.debug('Variables injected into prompt', { 
      variableCount: Object.keys(variables).length,
      variables: Object.keys(variables)
    });

    return result;
  }

  /**
   * Retrieve a prompt and inject variables in one operation
   */
  public async getPromptWithVariables(
    name: PromptName,
    variables: Record<string, string>,
    config?: PromptConfig
  ): Promise<PromptResult> {
    const promptResult = await this.getPrompt(name, config);
    const injectedPrompt = this.injectVariables(promptResult.prompt, variables);

    return {
      ...promptResult,
      prompt: injectedPrompt,
    };
  }

  /**
   * Clear cached prompt for a specific name and environment
   */
  public clearCache(name?: PromptName): void {
    if (name) {
      const cacheKey = this.getCacheKey(name, this.environment);
      this.cache.delete(cacheKey);
      logger.debug('Prompt cache cleared', { name, environment: this.environment });
    } else {
      this.cache.clear();
      logger.debug('All prompt cache cleared');
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): {
    totalEntries: number;
    entries: Array<{
      key: string;
      cachedAt: Date;
      expiresAt: Date;
      expired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, cache]) => ({
      key,
      cachedAt: new Date(cache.cachedAt),
      expiresAt: new Date(cache.expiresAt),
      expired: now > cache.expiresAt,
    }));

    return {
      totalEntries: this.cache.size,
      entries,
    };
  }

  private getCacheKey(name: PromptName, environment: string): string {
    return `${name}:${environment}`;
  }

  private getCachedPrompt(cacheKey: string): PromptCache | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(cacheKey);
      logger.debug('Expired prompt removed from cache', { cacheKey });
      return null;
    }

    return cached;
  }

  private cachePrompt(
    cacheKey: string,
    promptResult: PromptResult,
    ttlSeconds: number
  ): void {
    const now = Date.now();
    const cache: PromptCache = {
      prompt: promptResult.prompt,
      version: promptResult.version,
      metadata: promptResult.metadata,
      cachedAt: now,
      expiresAt: now + (ttlSeconds * 1000),
    };

    this.cache.set(cacheKey, cache);
    logger.debug('Prompt cached', { 
      cacheKey, 
      ttlSeconds,
      version: promptResult.version 
    });
  }

  private async fetchPromptFromLangFuse(name: PromptName): Promise<PromptResult> {
    // TODO: Implement actual LangFuse prompt retrieval when LangFuse SDK supports it
    // For now, we'll use a placeholder that indicates LangFuse integration
    // In production, this would call LangFuse's prompt management API
    
    throw new Error(
      `LangFuse prompt retrieval not yet implemented for '${name}'. ` +
      `Please configure the prompt '${name}' in your LangFuse dashboard for environment '${this.environment}'. ` +
      `This system requires all prompts to be managed in LangFuse - no local fallbacks are supported.`
    );
  }
}

// Factory function for creating prompt service
export const createPromptService = (langfuseService: LangFuseService): PromptService => {
  return new PromptService(langfuseService);
};