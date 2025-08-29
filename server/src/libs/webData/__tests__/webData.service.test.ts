import { WebDataService } from '../webData.service';
import { IWebDataProvider } from '../interfaces/webData.interface';
import { mockEmployee, mockCompany } from './mocks';

// Mock dependencies
jest.mock('@/libs/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create a mock provider for testing
const createMockProvider = (name = 'MockProvider', healthy = true): IWebDataProvider => ({
  providerName: name,
  isHealthy: healthy,
  searchEmployees: jest.fn(),
  getEmployeeById: jest.fn(),
  searchCompanies: jest.fn(),
  getCompanyById: jest.fn(),
  getCompanyByDomain: jest.fn(),
  getEmployeesByCompany: jest.fn(),
  getCompanyWithAllEmployees: jest.fn(),
  healthCheck: jest.fn(),
  clearCache: jest.fn(),
  getCacheStats: jest.fn(),
});

describe('WebDataService', () => {
  let service: WebDataService;
  let mockProvider: IWebDataProvider;

  beforeEach(() => {
    // Use custom provider to avoid CoreSignal client initialization issues
    mockProvider = createMockProvider();
    service = new WebDataService('custom', mockProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and provider management', () => {
    it('should initialize with custom provider', () => {
      const providerInfo = service.getProviderInfo();
      expect(providerInfo.type).toBe('custom');
      expect(providerInfo.name).toBe('MockProvider');
    });

    it('should initialize with custom provider with custom name', () => {
      const customProvider = createMockProvider('CustomTestProvider');
      const customService = new WebDataService('custom', customProvider);
      const providerInfo = customService.getProviderInfo();

      expect(providerInfo.type).toBe('custom');
      expect(providerInfo.name).toBe('CustomTestProvider');
    });

    it('should throw error for unimplemented providers', () => {
      expect(() => new WebDataService('apollo')).toThrow(
        'Provider apollo is not yet implemented. Available providers: coresignal, custom'
      );
    });

    it('should throw error for custom provider without instance', () => {
      expect(() => new WebDataService('custom')).toThrow(
        'Custom provider instance is required when using custom provider type'
      );
    });

    it('should switch providers', () => {
      const newProvider = createMockProvider('NewMockProvider');

      service.switchProvider('custom', newProvider);
      const providerInfo = service.getProviderInfo();

      expect(providerInfo.type).toBe('custom');
      expect(providerInfo.name).toBe('NewMockProvider');
    });
  });

  describe('employee methods', () => {
    it('should search employees', async () => {
      const filters = { company_name: 'TechCorp Inc' };
      const options = { limit: 50 };
      const expectedResult = {
        employees: [mockEmployee],
        total_count: 1,
        page: 1,
        limit: 50,
        provider: 'MockProvider',
      };

      (mockProvider.searchEmployees as jest.Mock).mockResolvedValue(expectedResult);

      const result = await service.searchEmployees(filters, options);

      expect(mockProvider.searchEmployees).toHaveBeenCalledWith(filters, options);
      expect(result).toEqual(expectedResult);
    });

    it('should get employee by ID', async () => {
      const id = 'emp_123';
      const options = { useCache: true };

      mockProvider.getEmployeeById.mockResolvedValue(mockEmployee);

      const result = await service.getEmployeeById(id, options);

      expect(mockProvider.getEmployeeById).toHaveBeenCalledWith(id, options);
      expect(result).toEqual(mockEmployee);
    });

    it('should handle employee search errors', async () => {
      const filters = { company_name: 'TechCorp Inc' };
      const error = new Error('API Error');

      mockProvider.searchEmployees.mockRejectedValue(error);

      await expect(service.searchEmployees(filters)).rejects.toThrow('API Error');
      expect(mockProvider.searchEmployees).toHaveBeenCalledWith(filters, undefined);
    });
  });

  describe('company methods', () => {
    it('should search companies', async () => {
      const filters = { name: 'TechCorp' };
      const options = { limit: 10 };
      const expectedResult = {
        companies: [mockCompany],
        total_count: 1,
        page: 1,
        limit: 10,
        provider: 'MockProvider',
      };

      mockProvider.searchCompanies.mockResolvedValue(expectedResult);

      const result = await service.searchCompanies(filters, options);

      expect(mockProvider.searchCompanies).toHaveBeenCalledWith(filters, options);
      expect(result).toEqual(expectedResult);
    });

    it('should get company by ID', async () => {
      const id = 'comp_456';
      const options = { useCache: false };

      mockProvider.getCompanyById.mockResolvedValue(mockCompany);

      const result = await service.getCompanyById(id, options);

      expect(mockProvider.getCompanyById).toHaveBeenCalledWith(id, options);
      expect(result).toEqual(mockCompany);
    });

    it('should get company by domain', async () => {
      const domain = 'techcorp.com';
      const options = { cacheTtl: 3600 };

      mockProvider.getCompanyByDomain.mockResolvedValue(mockCompany);

      const result = await service.getCompanyByDomain(domain, options);

      expect(mockProvider.getCompanyByDomain).toHaveBeenCalledWith(domain, options);
      expect(result).toEqual(mockCompany);
    });
  });

  describe('combined methods', () => {
    it('should get employees by company', async () => {
      const companyIdentifier = 'techcorp.com';
      const options = { includePastEmployees: true };
      const expectedResult = {
        company: mockCompany,
        employees: {
          current: [mockEmployee],
          former: [],
          total_current: 1,
          total_former: 0,
        },
        provider: 'MockProvider',
      };

      mockProvider.getEmployeesByCompany.mockResolvedValue(expectedResult);

      const result = await service.getEmployeesByCompany(companyIdentifier, options);

      expect(mockProvider.getEmployeesByCompany).toHaveBeenCalledWith(companyIdentifier, options);
      expect(result).toEqual(expectedResult);
    });

    it('should get company with all employees', async () => {
      const companyIdentifier = 'TechCorp Inc';
      const options = { includePastEmployees: false, useCache: true };
      const expectedResult = {
        company: mockCompany,
        employees: {
          current: [mockEmployee],
          former: [],
          total_current: 1,
          total_former: 0,
        },
        provider: 'MockProvider',
      };

      mockProvider.getCompanyWithAllEmployees.mockResolvedValue(expectedResult);

      const result = await service.getCompanyWithAllEmployees(companyIdentifier, options);

      expect(mockProvider.getCompanyWithAllEmployees).toHaveBeenCalledWith(
        companyIdentifier,
        options
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('utility methods', () => {
    it('should perform health check', async () => {
      mockProvider.healthCheck.mockResolvedValue(true);

      const result = await service.healthCheck();

      expect(mockProvider.healthCheck).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle health check failure', async () => {
      mockProvider.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should clear cache', async () => {
      const pattern = 'test-pattern';
      mockProvider.clearCache.mockResolvedValue();

      await service.clearCache(pattern);

      expect(mockProvider.clearCache).toHaveBeenCalledWith(pattern);
    });

    it('should get cache stats', async () => {
      const expectedStats = { hits: 100, misses: 10, size: 1024 };
      mockProvider.getCacheStats.mockResolvedValue(expectedStats);

      const result = await service.getCacheStats();

      expect(mockProvider.getCacheStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });
  });

  describe('provider properties', () => {
    it('should return correct provider name', () => {
      expect(service.providerName).toBe('WebDataService(MockProvider)');
    });

    it('should return provider health status', () => {
      // Create new providers with different health status
      const unhealthyProvider = Object.assign(createMockProvider(), {
        isHealthy: false,
      });
      const healthyProvider = Object.assign(createMockProvider(), {
        isHealthy: true,
      });

      service.switchProvider('custom', unhealthyProvider);
      expect(service.isHealthy).toBe(false);

      service.switchProvider('custom', healthyProvider);
      expect(service.isHealthy).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from underlying provider', async () => {
      const error = new Error('Provider error');
      mockProvider.searchEmployees.mockRejectedValue(error);

      await expect(service.searchEmployees({ company_name: 'test' })).rejects.toThrow(
        'Provider error'
      );
    });

    it('should propagate errors with proper logging', async () => {
      const error = new Error('Cache clear failed');
      mockProvider.clearCache.mockRejectedValue(error);

      await expect(service.clearCache()).rejects.toThrow('Cache clear failed');
    });
  });
});
