import { CoreSignalWebDataProvider } from '../providers/coresignal.provider';
import { CoreSignalClient } from '../coresignal.client';
import {
  mockEmployee,
  mockCompany,
  mockEmployeeSearchResponse,
  mockCompanySearchResponse,
  mockCompanyWithEmployees,
} from '../__mocks__';

// Mock dependencies
jest.mock('../coresignal.client');
jest.mock('@/libs/cache-client');
jest.mock('@/libs/cache', () => ({
  cacheManager: {
    set: jest.fn(),
    get: jest.fn(),
  },
}));
jest.mock('@/libs/bullmq', () => ({
  createRedisConnection: jest.fn(),
}));
jest.mock('@/libs/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const MockedCoreSignalClient = CoreSignalClient as jest.MockedClass<typeof CoreSignalClient>;

describe('CoreSignalWebDataProvider', () => {
  let provider: CoreSignalWebDataProvider;
  let mockClient: jest.Mocked<CoreSignalClient>;

  beforeEach(() => {
    // Setup mock client
    mockClient = {
      searchEmployees: jest.fn(),
      getEmployeeById: jest.fn(),
      searchCompanies: jest.fn(),
      getCompanyById: jest.fn(),
      getCompanyByDomain: jest.fn(),
      getEmployeesByCompany: jest.fn(),
      getCompanyWithAllEmployees: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn(),
    } as any;

    MockedCoreSignalClient.mockImplementation(() => mockClient);
    provider = new CoreSignalWebDataProvider();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('provider properties', () => {
    it('should have correct provider name', () => {
      expect(provider.providerName).toBe('CoreSignal');
    });

    it('should be healthy by default', () => {
      expect(provider.isHealthy).toBe(true);
    });

    it('should accept custom client instance', () => {
      const customClient = new CoreSignalClient();
      const customProvider = new CoreSignalWebDataProvider(customClient);
      expect(customProvider.providerName).toBe('CoreSignal');
    });
  });

  describe('employee methods', () => {
    it('should search employees and adapt response', async () => {
      const filters = { company_name: 'TechCorp Inc', job_title: 'Engineer' };
      const options = { limit: 50, useCache: true };

      mockClient.searchEmployees.mockResolvedValue(mockEmployeeSearchResponse);

      const result = await provider.searchEmployees(filters, options);

      expect(mockClient.searchEmployees).toHaveBeenCalledWith(
        {
          company_name: 'TechCorp Inc',
          job_title: 'Engineer',
          company_domain: undefined,
          location: undefined,
          skills: undefined,
          experience_level: undefined,
          keywords: undefined,
          limit: 50,
          offset: undefined,
        },
        {
          useCache: true,
          cacheTtl: undefined,
        }
      );

      expect(result).toEqual({
        employees: [expect.objectContaining({ id: mockEmployee.id })],
        total_count: mockEmployeeSearchResponse.total_count,
        page: mockEmployeeSearchResponse.page,
        limit: mockEmployeeSearchResponse.limit,
        provider: 'CoreSignal',
      });
    });

    it('should get employee by ID and adapt response', async () => {
      const id = 'emp_123';
      const options = { useCache: false };

      mockClient.getEmployeeById.mockResolvedValue(mockEmployee);

      const result = await provider.getEmployeeById(id, options);

      expect(mockClient.getEmployeeById).toHaveBeenCalledWith(id, {
        useCache: false,
        cacheTtl: undefined,
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: mockEmployee.id,
          full_name: mockEmployee.full_name,
          job_title: mockEmployee.job_title,
        })
      );
    });

    it('should handle employee search errors', async () => {
      const filters = { company_name: 'TechCorp Inc' };
      const error = {
        message: 'API Error',
        code: 'API_ERROR',
        statusCode: 500,
      };

      mockClient.searchEmployees.mockRejectedValue(error);

      await expect(provider.searchEmployees(filters)).rejects.toEqual({
        message: 'API Error',
        code: 'API_ERROR',
        statusCode: 500,
        provider: 'CoreSignal',
      });

      expect(provider.isHealthy).toBe(false);
    });
  });

  describe('company methods', () => {
    it('should search companies and adapt response', async () => {
      const filters = { name: 'TechCorp', industry: 'Technology' };
      const options = { limit: 10 };

      mockClient.searchCompanies.mockResolvedValue(mockCompanySearchResponse);

      const result = await provider.searchCompanies(filters, options);

      expect(mockClient.searchCompanies).toHaveBeenCalledWith(
        {
          name: 'TechCorp',
          domain: undefined,
          industry: 'Technology',
          location: undefined,
          size: undefined,
          limit: 10,
          offset: undefined,
        },
        {
          useCache: undefined,
          cacheTtl: undefined,
        }
      );

      expect(result).toEqual({
        companies: [expect.objectContaining({ id: mockCompany.id })],
        total_count: mockCompanySearchResponse.total_count,
        page: mockCompanySearchResponse.page,
        limit: mockCompanySearchResponse.limit,
        provider: 'CoreSignal',
      });
    });

    it('should get company by ID and adapt response', async () => {
      const id = 'comp_456';
      const options = { cacheTtl: 3600 };

      mockClient.getCompanyById.mockResolvedValue(mockCompany);

      const result = await provider.getCompanyById(id, options);

      expect(mockClient.getCompanyById).toHaveBeenCalledWith(id, {
        useCache: undefined,
        cacheTtl: 3600,
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: mockCompany.id,
          name: mockCompany.name,
          domain: mockCompany.domain,
        })
      );
    });

    it('should get company by domain and adapt response', async () => {
      const domain = 'techcorp.com';

      mockClient.getCompanyByDomain.mockResolvedValue(mockCompany);

      const result = await provider.getCompanyByDomain(domain);

      expect(mockClient.getCompanyByDomain).toHaveBeenCalledWith(domain, {
        useCache: undefined,
        cacheTtl: undefined,
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: mockCompany.id,
          name: mockCompany.name,
          domain: mockCompany.domain,
        })
      );
    });
  });

  describe('combined methods', () => {
    it('should get employees by company and adapt response', async () => {
      const companyIdentifier = 'techcorp.com';
      const options = { includePastEmployees: true, useCache: true };

      mockClient.getEmployeesByCompany.mockResolvedValue(mockCompanyWithEmployees);

      const result = await provider.getEmployeesByCompany(companyIdentifier, options);

      expect(mockClient.getEmployeesByCompany).toHaveBeenCalledWith(companyIdentifier, {
        useCache: true,
        cacheTtl: undefined,
        includePastEmployees: true,
      });

      expect(result).toEqual({
        company: expect.objectContaining({ id: mockCompany.id }),
        employees: {
          current: [expect.objectContaining({ id: mockEmployee.id })],
          former: [],
          total_current: 1,
          total_former: 0,
        },
        provider: 'CoreSignal',
      });
    });

    it('should get company with all employees and adapt response', async () => {
      const companyIdentifier = 'TechCorp Inc';
      const options = { includePastEmployees: false };

      const mockResult = {
        company: mockCompany,
        employees: mockCompanyWithEmployees,
      };

      mockClient.getCompanyWithAllEmployees.mockResolvedValue(mockResult);

      const result = await provider.getCompanyWithAllEmployees(companyIdentifier, options);

      expect(mockClient.getCompanyWithAllEmployees).toHaveBeenCalledWith(companyIdentifier, {
        useCache: undefined,
        cacheTtl: undefined,
        includePastEmployees: false,
      });

      expect(result).toEqual({
        company: expect.objectContaining({ id: mockCompany.id }),
        employees: expect.objectContaining({
          current: expect.any(Array),
          former: expect.any(Array),
        }),
        provider: 'CoreSignal',
      });
    });
  });

  describe('utility methods', () => {
    it('should perform health check successfully', async () => {
      mockClient.searchCompanies.mockResolvedValue(mockCompanySearchResponse);

      const result = await provider.healthCheck();

      expect(mockClient.searchCompanies).toHaveBeenCalledWith(
        { name: 'test', limit: 1 },
        { useCache: false }
      );
      expect(result).toBe(true);
      expect(provider.isHealthy).toBe(true);
    });

    it('should handle health check failure', async () => {
      const error = new Error('Health check failed');
      mockClient.searchCompanies.mockRejectedValue(error);

      const result = await provider.healthCheck();

      expect(result).toBe(false);
      expect(provider.isHealthy).toBe(false);
    });

    it('should clear cache', async () => {
      const pattern = 'test-pattern';
      mockClient.clearCache.mockResolvedValue();

      await provider.clearCache(pattern);

      expect(mockClient.clearCache).toHaveBeenCalledWith(pattern);
    });

    it('should get cache stats', async () => {
      const expectedStats = { hits: 100, misses: 10, size: 1024 };
      mockClient.getCacheStats.mockResolvedValue(expectedStats);

      const result = await provider.getCacheStats();

      expect(mockClient.getCacheStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });

    it('should handle cache operation errors', async () => {
      const error = {
        message: 'Cache error',
        code: 'CACHE_ERROR',
        statusCode: 500,
      };

      mockClient.clearCache.mockRejectedValue(error);

      await expect(provider.clearCache()).rejects.toEqual({
        message: 'Cache error',
        code: 'CACHE_ERROR',
        statusCode: 500,
        provider: 'CoreSignal',
      });
    });
  });

  describe('data adaptation', () => {
    it('should properly adapt employee data', async () => {
      const complexEmployee = {
        ...mockEmployee,
        location: {
          country: 'United States',
          region: 'California',
          city: 'San Francisco',
        },
        experience: [
          {
            company_name: 'TechCorp Inc.',
            job_title: 'Senior Engineer',
            start_date: '2021-01-01',
            end_date: '2023-12-31',
            duration: '3 years',
            description: 'Full-stack development',
            location: 'San Francisco, CA',
          },
        ],
        education: [
          {
            institution: 'Stanford University',
            degree: 'Bachelor of Science',
            field_of_study: 'Computer Science',
            start_date: '2015-09-01',
            end_date: '2019-06-01',
            description: 'Graduated Magna Cum Laude',
          },
        ],
      };

      mockClient.getEmployeeById.mockResolvedValue(complexEmployee);

      const result = await provider.getEmployeeById('emp_123');

      expect(result.location).toEqual({
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
      });
      expect(result.experience).toHaveLength(1);
      expect(result.education).toHaveLength(1);
    });

    it('should properly adapt company data with complex structure', async () => {
      const complexCompany = {
        ...mockCompany,
        location: {
          headquarters: {
            country: 'United States',
            region: 'California',
            city: 'San Francisco',
            address: '123 Tech Street',
          },
          locations: [
            {
              country: 'United States',
              region: 'California',
              city: 'San Francisco',
              address: '123 Tech Street',
              is_headquarters: true,
            },
          ],
        },
      };

      mockClient.getCompanyById.mockResolvedValue(complexCompany);

      const result = await provider.getCompanyById('comp_456');

      expect(result.location?.headquarters).toEqual({
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        address: '123 Tech Street',
      });
      expect(result.location?.locations).toHaveLength(1);
    });
  });
});
