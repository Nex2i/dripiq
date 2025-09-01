import { Buffer } from 'buffer';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import { CacheClient } from '@/libs/cache-client';
import { cacheManager } from '@/libs/cache';
import { logger } from '@/libs/logger';
import {
  CoreSignalError,
  CoreSignalRequestOptions,
  CoreSignalEmployeeSearchQuery,
  CoreSignalEmployeeSearchResponse,
  CoreSignalEmployeeCollectionResponse,
} from './types';

dotenv.config();

/**
 * CoreSignal API v2 Multi-Source Client for employee data retrieval
 * Provides caching, error handling, and multi-source employee search/collection functionality
 */
export class CoreSignalClient {
  private readonly baseUrl = 'https://api.coresignal.com/cdapi/v2';
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

    // Initialize HTTP client with API key header (not Bearer token)
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        apikey: this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds timeout for multi-source calls
    });

    // Initialize cache client with CoreSignal prefix
    this.cacheClient = new CacheClient(cacheManager, 'coresignal-v2');

    // Set up request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  /**
   * Set up axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('CoreSignal API v2 request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasData: !!config.data,
        });
        return config;
      },
      (error) => {
        logger.error('CoreSignal API v2 request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('CoreSignal API v2 response', {
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
          message: error.response?.data?.message || error.message,
        };
        logger.error('CoreSignal API v2 response error', errorDetails);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Handle and standardize API errors
   */
  private handleApiError(error: any): CoreSignalError {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    const code = error.response?.data?.code || 'UNKNOWN_ERROR';

    return {
      message,
      code,
      statusCode: status,
    };
  }

  /**
   * Generate cache key for requests
   */
  private generateCacheKey(endpoint: string, params: any): string {
    const paramString = JSON.stringify(params);
    return `${endpoint}:${Buffer.from(paramString).toString('base64')}`;
  }

  /**
   * Make cached API request with POST method
   */
  private async makePostRequest<T>(
    endpoint: string,
    data: any = {},
    options: CoreSignalRequestOptions = {}
  ): Promise<T> {
    const { useCache = true, cacheTtl = this.defaultCacheTtl } = options;
    const cacheKey = this.generateCacheKey(endpoint, data);

    // Try to get from cache first
    if (useCache) {
      const cachedResult = await this.cacheClient.getJson<T>(cacheKey);
      if (cachedResult) {
        logger.debug('CoreSignal v2 cache hit', { endpoint, cacheKey });
        return cachedResult;
      }
    }

    // Make API request
    logger.debug('CoreSignal v2 cache miss, making API request', { endpoint, cacheKey });
    const response: AxiosResponse<T> = await this.httpClient.post(endpoint, data);

    // Cache the result
    if (useCache) {
      await this.cacheClient.setJson(cacheKey, response.data, cacheTtl);
    }

    return response.data;
  }

  /**
   * Make cached API request with GET method
   */
  private async makeGetRequest<T>(
    endpoint: string,
    options: CoreSignalRequestOptions = {}
  ): Promise<T> {
    const { useCache = true, cacheTtl = this.defaultCacheTtl } = options;
    const cacheKey = this.generateCacheKey(endpoint, {});

    // Try to get from cache first
    if (useCache) {
      const cachedResult = await this.cacheClient.getJson<T>(cacheKey);
      if (cachedResult) {
        logger.debug('CoreSignal v2 cache hit', { endpoint, cacheKey });
        return cachedResult;
      }
    }

    // Make API request
    logger.debug('CoreSignal v2 cache miss, making API request', { endpoint, cacheKey });
    const response: AxiosResponse<T> = await this.httpClient.get(endpoint);

    // Cache the result
    if (useCache) {
      await this.cacheClient.setJson(cacheKey, response.data, cacheTtl);
    }

    return response.data;
  }

  /**
   * Search for employees by company domain using multi-source API
   */
  async searchEmployeesByDomain(
    domain: string,
    options: CoreSignalRequestOptions = {}
  ): Promise<CoreSignalEmployeeSearchResponse> {
    try {
      const { isDecisionMaker = true } = options;

      const searchQuery: CoreSignalEmployeeSearchQuery = {
        query: {
          bool: {
            must: [
              ...(isDecisionMaker
                ? [
                    {
                      term: {
                        is_decision_maker: 1,
                      },
                    },
                  ]
                : []),
              {
                nested: {
                  path: 'experience',
                  query: {
                    match_phrase: {
                      'experience.company_website.domain_only': domain,
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const response = await this.makePostRequest<CoreSignalEmployeeSearchResponse>(
        '/employee_multi_source/search/es_dsl',
        searchQuery,
        options
      );

      logger.info('CoreSignal employee search completed', {
        domain,
        isDecisionMaker,
        resultCount: response.length,
      });

      return response;
    } catch (error) {
      logger.error('Failed to search employees by domain', { error, domain, options });
      throw error;
    }
  }

  /**
   * Collect employee data by ID using multi-source API
   */
  async collectEmployeeById(
    id: number,
    options: CoreSignalRequestOptions = {}
  ): Promise<CoreSignalEmployeeCollectionResponse> {
    try {
      const response = await this.makeGetRequest<CoreSignalEmployeeCollectionResponse>(
        `/employee_multi_source/collect/${id}`,
        options
      );

      logger.debug('CoreSignal employee collection completed', {
        id,
        employeeName: response.full_name,
      });

      return response;
    } catch (error) {
      logger.error('Failed to collect employee by ID', { error, id });
      throw error;
    }
  }

  /**
   * Get employees by company domain (search + collect)
   */
  async getEmployeesByCompanyDomain(
    domain: string,
    options: CoreSignalRequestOptions = {}
  ): Promise<CoreSignalEmployeeCollectionResponse[]> {
    try {
      // First, search for employee IDs
      const employeeIds = await this.searchEmployeesByDomain(domain, options);

      if (employeeIds.length === 0) {
        logger.info('No employees found for domain', { domain });
        return [];
      }

      // Then, collect detailed data for each employee
      logger.info('Collecting employee data', {
        domain,
        employeeCount: employeeIds.length,
      });

      const employees: CoreSignalEmployeeCollectionResponse[] = [];

      // Process employees in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < employeeIds.length; i += batchSize) {
        const batch = employeeIds.slice(i, i + batchSize);
        const batchPromises = batch.map((id) =>
          this.collectEmployeeById(id, options).catch((error) => {
            logger.warn('Failed to collect employee data', { id, error: error.message });
            return null;
          })
        );

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(
          (result) => result !== null
        ) as CoreSignalEmployeeCollectionResponse[];
        employees.push(...validResults);

        // Add a small delay between batches to be respectful to the API
        if (i + batchSize < employeeIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      logger.info('Employee collection completed', {
        domain,
        requestedCount: employeeIds.length,
        collectedCount: employees.length,
      });

      return employees;
    } catch (error) {
      logger.error('Failed to get employees by company domain', { error, domain });
      throw error;
    }
  }

  /**
   * Clear cache for specific pattern or all CoreSignal cache
   */
  async clearCache(pattern?: string): Promise<void> {
    // Use the cache manager directly for clear operations
    await cacheManager.clear();
    logger.info('CoreSignal v2 cache cleared', { pattern });
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ hits: number; misses: number; size: number }> {
    const stats = await cacheManager.getStats();
    return {
      hits: stats.hits || 0,
      misses: stats.misses || 0,
      size: stats.keys || 0,
    };
  }
}
