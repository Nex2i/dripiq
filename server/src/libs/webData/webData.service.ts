import { logger } from '@/libs/logger';
import { CoreSignalWebDataProvider } from './providers/coresignal.provider';
import {
  IWebDataProviderBase,
  IWebDataProviderWithDomainSearch,
  WebDataSearchOptions,
  WebDataCompanyEmployeesResult,
} from './interfaces/webData.interface';

type WebDataProviderType = 'coresignal' | 'custom';

/**
 * WebData Service - Main entry point for employee and company data operations
 * Provides a unified interface that can switch between different data providers
 */
export class WebDataService {
  private provider: IWebDataProviderBase;
  private providerType: WebDataProviderType;

  constructor(
    providerType: WebDataProviderType = 'coresignal',
    customProvider?: IWebDataProviderBase
  ) {
    this.providerType = providerType;
    this.provider = this.createProvider(providerType, customProvider);

    logger.info('WebDataService initialized', {
      providerType: this.providerType,
      providerName: this.provider.providerName,
    });
  }

  /**
   * Factory method to create providers
   */
  private createProvider(
    type: WebDataProviderType,
    customProvider?: IWebDataProviderBase
  ): IWebDataProviderBase {
    switch (type) {
      case 'coresignal':
        return new CoreSignalWebDataProvider();

      case 'custom':
        if (!customProvider) {
          throw new Error('Custom provider instance is required when using custom provider type');
        }
        return customProvider;

      default:
        throw new Error(`Unknown provider type: ${type}. Available providers: coresignal, custom`);
    }
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: this.provider.providerName,
      type: this.providerType,
    };
  }

  get providerName(): string {
    return `WebDataService(${this.provider.providerName})`;
  }

  /**
   * Get employees by company domain using multi-source data
   */
  async getEmployeesByCompanyDomain(
    domain: string,
    options?: WebDataSearchOptions & { isDecisionMaker?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    try {
      logger.info('WebDataService: Getting employees by company domain', {
        domain,
        options,
        provider: this.provider.providerName,
      });

      // Check if provider supports this method
      if (
        'getEmployeesByCompanyDomain' in this.provider &&
        typeof this.provider.getEmployeesByCompanyDomain === 'function'
      ) {
        return await (
          this.provider as IWebDataProviderWithDomainSearch
        ).getEmployeesByCompanyDomain(domain, options);
      } else {
        throw new Error(
          `Provider ${this.provider.providerName} does not support getEmployeesByCompanyDomain`
        );
      }
    } catch (error) {
      logger.error('WebDataService: Get employees by company domain failed', {
        domain,
        provider: this.provider.providerName,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      await this.provider.clearCache(pattern);
      logger.info('WebDataService: Cache cleared', {
        provider: this.provider.providerName,
        pattern,
      });
    } catch (error) {
      logger.error('WebDataService: Clear cache failed', {
        provider: this.provider.providerName,
        error: String(error),
        pattern,
      });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ hits: number; misses: number; size: number }> {
    try {
      const stats = await this.provider.getCacheStats();
      logger.debug('WebDataService: Cache stats retrieved', {
        provider: this.provider.providerName,
        stats,
      });
      return stats;
    } catch (error) {
      logger.error('WebDataService: Get cache stats failed', {
        provider: this.provider.providerName,
        error: String(error),
      });
      throw error;
    }
  }
}
