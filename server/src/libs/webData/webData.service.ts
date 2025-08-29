import { logger } from '@/libs/logger';
import { CoreSignalWebDataProvider } from './providers/coresignal.provider';
import {
  IWebDataProvider,
  WebDataSearchOptions,
  EmployeeSearchFilters,
  CompanySearchFilters,
  WebDataEmployee,
  WebDataCompany,
  WebDataEmployeeSearchResult,
  WebDataCompanySearchResult,
  WebDataCompanyEmployeesResult,
} from './interfaces/webData.interface';

type WebDataProviderType = 'coresignal' | 'apollo' | 'zoominfo' | 'custom';

/**
 * WebData Service - Main entry point for all employee and company data operations
 * Provides a unified interface that can switch between different data providers
 */
export class WebDataService implements IWebDataProvider {
  private provider: IWebDataProvider;
  private providerType: WebDataProviderType;

  constructor(providerType: WebDataProviderType = 'coresignal', customProvider?: IWebDataProvider) {
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
    customProvider?: IWebDataProvider
  ): IWebDataProvider {
    switch (type) {
      case 'coresignal':
        return new CoreSignalWebDataProvider();

      case 'custom':
        if (!customProvider) {
          throw new Error('Custom provider instance is required when using custom provider type');
        }
        return customProvider;

      case 'apollo':
      case 'zoominfo':
        throw new Error(
          `Provider ${type} is not yet implemented. Available providers: coresignal, custom`
        );

      default:
        throw new Error(`Unknown provider type: ${type}. Available providers: coresignal, custom`);
    }
  }

  /**
   * Switch to a different data provider
   */
  switchProvider(providerType: WebDataProviderType, customProvider?: IWebDataProvider): void {
    logger.info('Switching WebData provider', {
      from: this.providerType,
      to: providerType,
    });

    this.providerType = providerType;
    this.provider = this.createProvider(providerType, customProvider);

    logger.info('WebData provider switched successfully', {
      providerType: this.providerType,
      providerName: this.provider.providerName,
    });
  }

  /**
   * Get current provider information
   */
  getProviderInfo(): { type: WebDataProviderType; name: string; isHealthy: boolean } {
    return {
      type: this.providerType,
      name: this.provider.providerName,
      isHealthy: this.provider.isHealthy,
    };
  }

  // Delegate all IWebDataProvider methods to the current provider

  get providerName(): string {
    return `WebDataService(${this.provider.providerName})`;
  }

  get isHealthy(): boolean {
    return this.provider.isHealthy;
  }

  async searchEmployees(
    filters: EmployeeSearchFilters,
    options?: WebDataSearchOptions
  ): Promise<WebDataEmployeeSearchResult> {
    logger.info('WebDataService: Searching employees', {
      provider: this.provider.providerName,
      filters,
      options,
    });

    try {
      const result = await this.provider.searchEmployees(filters, options);
      logger.debug('WebDataService: Employee search completed', {
        provider: this.provider.providerName,
        resultCount: result.employees.length,
        totalCount: result.total_count,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Employee search failed', {
        provider: this.provider.providerName,
        error: String(error),
        filters,
      });
      throw error;
    }
  }

  async getEmployeeById(id: string, options?: WebDataSearchOptions): Promise<WebDataEmployee> {
    logger.info('WebDataService: Getting employee by ID', {
      provider: this.provider.providerName,
      id,
      options,
    });

    try {
      const result = await this.provider.getEmployeeById(id, options);
      logger.debug('WebDataService: Employee retrieved by ID', {
        provider: this.provider.providerName,
        id,
        employeeName: result.full_name,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Get employee by ID failed', {
        provider: this.provider.providerName,
        error: String(error),
        id,
      });
      throw error;
    }
  }

  async searchCompanies(
    filters: CompanySearchFilters,
    options?: WebDataSearchOptions
  ): Promise<WebDataCompanySearchResult> {
    logger.info('WebDataService: Searching companies', {
      provider: this.provider.providerName,
      filters,
      options,
    });

    try {
      const result = await this.provider.searchCompanies(filters, options);
      logger.debug('WebDataService: Company search completed', {
        provider: this.provider.providerName,
        resultCount: result.companies.length,
        totalCount: result.total_count,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Company search failed', {
        provider: this.provider.providerName,
        error: String(error),
        filters,
      });
      throw error;
    }
  }

  async getCompanyById(id: string, options?: WebDataSearchOptions): Promise<WebDataCompany> {
    logger.info('WebDataService: Getting company by ID', {
      provider: this.provider.providerName,
      id,
      options,
    });

    try {
      const result = await this.provider.getCompanyById(id, options);
      logger.debug('WebDataService: Company retrieved by ID', {
        provider: this.provider.providerName,
        id,
        companyName: result.name,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Get company by ID failed', {
        provider: this.provider.providerName,
        error: String(error),
        id,
      });
      throw error;
    }
  }

  async getCompanyByDomain(
    domain: string,
    options?: WebDataSearchOptions
  ): Promise<WebDataCompany> {
    logger.info('WebDataService: Getting company by domain', {
      provider: this.provider.providerName,
      domain,
      options,
    });

    try {
      const result = await this.provider.getCompanyByDomain(domain, options);
      logger.debug('WebDataService: Company retrieved by domain', {
        provider: this.provider.providerName,
        domain,
        companyName: result.name,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Get company by domain failed', {
        provider: this.provider.providerName,
        error: String(error),
        domain,
      });
      throw error;
    }
  }

  async getEmployeesByCompany(
    companyIdentifier: string,
    options?: WebDataSearchOptions & { includePastEmployees?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    logger.info('WebDataService: Getting employees by company', {
      provider: this.provider.providerName,
      companyIdentifier,
      options,
    });

    try {
      const result = await this.provider.getEmployeesByCompany(companyIdentifier, options);
      logger.debug('WebDataService: Employees by company retrieved', {
        provider: this.provider.providerName,
        companyIdentifier,
        currentEmployees: result.employees.total_current,
        formerEmployees: result.employees.total_former,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Get employees by company failed', {
        provider: this.provider.providerName,
        error: String(error),
        companyIdentifier,
      });
      throw error;
    }
  }

  async getCompanyWithAllEmployees(
    companyIdentifier: string,
    options?: WebDataSearchOptions & { includePastEmployees?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    logger.info('WebDataService: Getting company with all employees', {
      provider: this.provider.providerName,
      companyIdentifier,
      options,
    });

    try {
      const result = await this.provider.getCompanyWithAllEmployees(companyIdentifier, options);
      logger.debug('WebDataService: Company with all employees retrieved', {
        provider: this.provider.providerName,
        companyIdentifier,
        companyName: result.company.name,
        currentEmployees: result.employees.total_current,
        formerEmployees: result.employees.total_former,
      });
      return result;
    } catch (error) {
      logger.error('WebDataService: Get company with all employees failed', {
        provider: this.provider.providerName,
        error: String(error),
        companyIdentifier,
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    logger.debug('WebDataService: Performing health check', {
      provider: this.provider.providerName,
    });

    try {
      const isHealthy = await this.provider.healthCheck();
      logger.info('WebDataService: Health check completed', {
        provider: this.provider.providerName,
        isHealthy,
      });
      return isHealthy;
    } catch (error) {
      logger.error('WebDataService: Health check failed', {
        provider: this.provider.providerName,
        error: String(error),
      });
      return false;
    }
  }

  async clearCache(pattern?: string): Promise<void> {
    logger.info('WebDataService: Clearing cache', {
      provider: this.provider.providerName,
      pattern,
    });

    try {
      await this.provider.clearCache(pattern);
      logger.info('WebDataService: Cache cleared successfully', {
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

  async getCacheStats(): Promise<{ hits: number; misses: number; size: number }> {
    logger.debug('WebDataService: Getting cache stats', {
      provider: this.provider.providerName,
    });

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
