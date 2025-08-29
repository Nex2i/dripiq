import axios, { AxiosInstance, AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import { CacheClient } from '@/libs/cache-client';
import { logger } from '@/libs/logger';
import {
  CoreSignalApiResponse,
  CoreSignalError,
  EmployeeSearchQuery,
  CompanySearchQuery,
  CoreSignalRequestOptions,
  Employee,
  Company,
  EmployeeSearchResponse,
  CompanySearchResponse,
  CompanyWithEmployees,
} from './types';

dotenv.config();

/**
 * CoreSignal API Client for employee and company data retrieval
 * Provides caching, error handling, and comprehensive employee/company search functionality
 */
export class CoreSignalClient {
  private readonly baseUrl = 'https://api.coresignal.com/v1';
  private readonly apiKey: string;
  private readonly httpClient: AxiosInstance;
  private readonly cacheClient: CacheClient;
  private readonly defaultCacheTtl = 60 * 60; // 1 hour in seconds

  constructor() {
    this.apiKey = process.env.CORESIGNAL_API_KEY || '';

    if (!this.apiKey) {
      throw new Error(
        'CoreSignal API key is missing. Make sure to set CORESIGNAL_API_KEY in your .env file.'
      );
    }

    // Initialize HTTP client with authentication
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Initialize cache client with CoreSignal prefix
    this.cacheClient = new CacheClient(undefined, 'coresignal');

    // Add request/response interceptors for logging
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('CoreSignal API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('CoreSignal API request error', { error: String(error) });
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('CoreSignal API response', {
          status: response.status,
          url: response.config.url,
          dataSize: JSON.stringify(response.data).length,
        });
        return response;
      },
      (error) => {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
        };
        logger.error('CoreSignal API response error', errorDetails);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Handle API errors and convert to standardized format
   */
  private handleApiError(error: any): CoreSignalError {
    const statusCode = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    const code = error.response?.data?.code || 'UNKNOWN_ERROR';

    return {
      message,
      code,
      statusCode,
    };
  }

  /**
   * Generate cache key for requests
   */
  private generateCacheKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = params[key];
          return result;
        },
        {} as Record<string, any>
      );

    const paramString = JSON.stringify(sortedParams);
    const hash = paramString.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `${endpoint}:${hash}`;
  }

  /**
   * Make cached API request
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    options: CoreSignalRequestOptions = {}
  ): Promise<T> {
    const { useCache = true, cacheTtl = this.defaultCacheTtl } = options;
    const cacheKey = this.generateCacheKey(endpoint, params);

    // Try to get from cache first
    if (useCache) {
      try {
        const cached = await this.cacheClient.getJson<T>(cacheKey);
        if (cached) {
          logger.debug('CoreSignal cache hit', { endpoint, cacheKey });
          return cached;
        }
      } catch (error) {
        logger.warn('CoreSignal cache get failed', { error: String(error), cacheKey });
      }
    }

    // Make API request
    const response: AxiosResponse<CoreSignalApiResponse<T>> = await this.httpClient.get(endpoint, {
      params,
    });

    const data = response.data.data;

    // Cache the response
    if (useCache && data) {
      try {
        await this.cacheClient.setJson(cacheKey, data, cacheTtl);
        logger.debug('CoreSignal data cached', { endpoint, cacheKey, ttl: cacheTtl });
      } catch (error) {
        logger.warn('CoreSignal cache set failed', { error: String(error), cacheKey });
      }
    }

    return data;
  }

  /**
   * Search for employees based on various criteria
   */
  async searchEmployees(
    query: EmployeeSearchQuery,
    options?: CoreSignalRequestOptions
  ): Promise<EmployeeSearchResponse> {
    logger.info('Searching employees', { query });

    const params = {
      ...query,
      limit: query.limit || 50,
      offset: query.offset || 0,
    };

    return this.makeRequest<EmployeeSearchResponse>('/employees/search', params, options);
  }

  /**
   * Get a specific employee by ID
   */
  async getEmployeeById(id: string, options?: CoreSignalRequestOptions): Promise<Employee> {
    logger.info('Getting employee by ID', { id });
    return this.makeRequest<Employee>(`/employees/${id}`, {}, options);
  }

  /**
   * Get employees by company name or domain
   */
  async getEmployeesByCompany(
    companyIdentifier: string,
    options?: CoreSignalRequestOptions & { includePastEmployees?: boolean }
  ): Promise<CompanyWithEmployees> {
    logger.info('Getting employees by company', { companyIdentifier });

    const { includePastEmployees = false, ...requestOptions } = options || {};

    const params = {
      company: companyIdentifier,
      include_past: includePastEmployees,
    };

    return this.makeRequest<CompanyWithEmployees>('/companies/employees', params, requestOptions);
  }

  /**
   * Search for companies based on various criteria
   */
  async searchCompanies(
    query: CompanySearchQuery,
    options?: CoreSignalRequestOptions
  ): Promise<CompanySearchResponse> {
    logger.info('Searching companies', { query });

    const params = {
      ...query,
      limit: query.limit || 50,
      offset: query.offset || 0,
    };

    return this.makeRequest<CompanySearchResponse>('/companies/search', params, options);
  }

  /**
   * Get a specific company by ID
   */
  async getCompanyById(id: string, options?: CoreSignalRequestOptions): Promise<Company> {
    logger.info('Getting company by ID', { id });
    return this.makeRequest<Company>(`/companies/${id}`, {}, options);
  }

  /**
   * Get company by domain
   */
  async getCompanyByDomain(domain: string, options?: CoreSignalRequestOptions): Promise<Company> {
    logger.info('Getting company by domain', { domain });
    return this.makeRequest<Company>('/companies/domain', { domain }, options);
  }

  /**
   * Get all employees for a company with full details
   * This is a convenience method that combines company and employee data
   */
  async getCompanyWithAllEmployees(
    companyIdentifier: string,
    options?: CoreSignalRequestOptions & { includePastEmployees?: boolean }
  ): Promise<{
    company: Company;
    employees: CompanyWithEmployees;
  }> {
    logger.info('Getting company with all employees', { companyIdentifier });

    // First, try to get company info
    let company: Company;
    try {
      // Try by domain first
      if (companyIdentifier.includes('.')) {
        company = await this.getCompanyByDomain(companyIdentifier, options);
      } else {
        // Search by name
        const searchResult = await this.searchCompanies(
          { name: companyIdentifier, limit: 1 },
          options
        );
        if (searchResult.companies.length === 0) {
          throw new Error(`Company not found: ${companyIdentifier}`);
        }
        company = searchResult.companies[0]!;
      }
    } catch (error) {
      logger.warn('Could not find company, proceeding with employee search only', {
        companyIdentifier,
        error: String(error),
      });
      company = {
        id: '',
        name: companyIdentifier,
      };
    }

    // Get employees
    const employees = await this.getEmployeesByCompany(companyIdentifier, options);

    return {
      company,
      employees,
    };
  }

  /**
   * Clear cache for a specific key pattern
   */
  async clearCache(pattern?: string): Promise<void> {
    logger.info('Clearing CoreSignal cache', { pattern });
    // Note: This would need implementation in the cache client
    // For now, just log the action
    logger.warn('Cache clearing not implemented in current cache client');
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ hits: number; misses: number; size: number }> {
    logger.info('Getting CoreSignal cache stats');
    // Note: This would need implementation in the cache client
    // For now, return placeholder stats
    return {
      hits: 0,
      misses: 0,
      size: 0,
    };
  }
}
