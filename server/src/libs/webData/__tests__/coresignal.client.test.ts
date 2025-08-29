import { CoreSignalClient } from '../coresignal.client';
import { CacheClient } from '@/libs/cache-client';
import axios from 'axios';
import {
  mockEmployee,
  mockEmployeeSearchResponse,
  mockCompany,
  mockCompanySearchResponse,
  mockCompanyWithEmployees,
} from './mocks';

// Mock dependencies
jest.mock('axios');
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

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedCacheClient = CacheClient as jest.MockedClass<typeof CacheClient>;

describe('CoreSignalClient', () => {
  let client: CoreSignalClient;
  let mockAxiosInstance: any;
  let mockCacheClient: jest.Mocked<CacheClient>;

  beforeEach(() => {
    // Setup axios mock
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Setup cache client mock
    mockCacheClient = {
      getJson: jest.fn(),
      setJson: jest.fn(),
    } as any;
    MockedCacheClient.mockImplementation(() => mockCacheClient);

    // Set environment variable
    process.env.CORESIGNAL_API_KEY = 'test-api-key';

    client = new CoreSignalClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.CORESIGNAL_API_KEY;
  });

  describe('constructor', () => {
    it('should throw error when API key is missing', () => {
      delete process.env.CORESIGNAL_API_KEY;
      expect(() => new CoreSignalClient()).toThrow(
        'CoreSignal API key is missing. Make sure to set CORESIGNAL_API_KEY in your .env file.'
      );
    });

    it('should initialize with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.coresignal.com/v1',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      expect(MockedCacheClient).toHaveBeenCalledWith(undefined, 'coresignal');
    });
  });

  describe('searchEmployees', () => {
    it('should return cached result when available', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      mockCacheClient.getJson.mockResolvedValue(mockEmployeeSearchResponse);

      const result = await client.searchEmployees(query);

      expect(mockCacheClient.getJson).toHaveBeenCalled();
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockEmployeeSearchResponse);
    });

    it('should make API request when cache miss', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockEmployeeSearchResponse },
      });

      const result = await client.searchEmployees(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/employees/search', {
        params: {
          company_name: 'TechCorp Inc.',
          limit: 50,
          offset: 0,
        },
      });
      expect(mockCacheClient.setJson).toHaveBeenCalled();
      expect(result).toEqual(mockEmployeeSearchResponse);
    });

    it('should use custom limit and offset', async () => {
      const query = { company_name: 'TechCorp Inc.', limit: 100, offset: 50 };
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockEmployeeSearchResponse },
      });

      await client.searchEmployees(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/employees/search', {
        params: {
          company_name: 'TechCorp Inc.',
          limit: 100,
          offset: 50,
        },
      });
    });

    it('should handle cache errors gracefully', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      mockCacheClient.getJson.mockRejectedValue(new Error('Cache error'));
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockEmployeeSearchResponse },
      });

      const result = await client.searchEmployees(query);

      expect(result).toEqual(mockEmployeeSearchResponse);
    });
  });

  describe('getEmployeeById', () => {
    it('should get employee by ID', async () => {
      const id = 'emp_123';
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockEmployee },
      });

      const result = await client.getEmployeeById(id);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/employees/emp_123', {
        params: {},
      });
      expect(result).toEqual(mockEmployee);
    });
  });

  describe('getEmployeesByCompany', () => {
    it('should get employees by company', async () => {
      const companyIdentifier = 'techcorp.com';
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockCompanyWithEmployees },
      });

      const result = await client.getEmployeesByCompany(companyIdentifier);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/employees', {
        params: {
          company: 'techcorp.com',
          include_past: false,
        },
      });
      expect(result).toEqual(mockCompanyWithEmployees);
    });

    it('should include past employees when requested', async () => {
      const companyIdentifier = 'techcorp.com';
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockCompanyWithEmployees },
      });

      await client.getEmployeesByCompany(companyIdentifier, {
        includePastEmployees: true,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/employees', {
        params: {
          company: 'techcorp.com',
          include_past: true,
        },
      });
    });
  });

  describe('searchCompanies', () => {
    it('should search companies', async () => {
      const query = { name: 'TechCorp' };
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockCompanySearchResponse },
      });

      const result = await client.searchCompanies(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/search', {
        params: {
          name: 'TechCorp',
          limit: 50,
          offset: 0,
        },
      });
      expect(result).toEqual(mockCompanySearchResponse);
    });
  });

  describe('getCompanyById', () => {
    it('should get company by ID', async () => {
      const id = 'comp_456';
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockCompany },
      });

      const result = await client.getCompanyById(id);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/comp_456', {
        params: {},
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('getCompanyByDomain', () => {
    it('should get company by domain', async () => {
      const domain = 'techcorp.com';
      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockCompany },
      });

      const result = await client.getCompanyByDomain(domain);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/domain', {
        params: { domain: 'techcorp.com' },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('getCompanyWithAllEmployees', () => {
    it('should get company with employees by domain', async () => {
      const companyIdentifier = 'techcorp.com';

      // Mock company lookup by domain
      mockCacheClient.getJson
        .mockResolvedValueOnce(null) // Company lookup cache miss
        .mockResolvedValueOnce(null); // Employees lookup cache miss

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { data: mockCompany } }) // Company by domain
        .mockResolvedValueOnce({ data: { data: mockCompanyWithEmployees } }); // Employees

      const result = await client.getCompanyWithAllEmployees(companyIdentifier);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/domain', {
        params: { domain: 'techcorp.com' },
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/employees', {
        params: {
          company: 'techcorp.com',
          include_past: false,
        },
      });
      expect(result).toEqual({
        company: mockCompany,
        employees: mockCompanyWithEmployees,
      });
    });

    it('should get company with employees by name', async () => {
      const companyIdentifier = 'TechCorp Inc';

      mockCacheClient.getJson
        .mockResolvedValueOnce(null) // Company search cache miss
        .mockResolvedValueOnce(null); // Employees lookup cache miss

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { data: mockCompanySearchResponse } }) // Company search
        .mockResolvedValueOnce({ data: { data: mockCompanyWithEmployees } }); // Employees

      const result = await client.getCompanyWithAllEmployees(companyIdentifier);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/companies/search', {
        params: {
          name: 'TechCorp Inc',
          limit: 1,
          offset: 0,
        },
      });
      expect(result.company).toEqual(mockCompany);
      expect(result.employees).toEqual(mockCompanyWithEmployees);
    });

    it('should handle company not found gracefully', async () => {
      const companyIdentifier = 'nonexistent.com';

      mockCacheClient.getJson
        .mockResolvedValueOnce(null) // Company lookup cache miss
        .mockResolvedValueOnce(null); // Employees lookup cache miss

      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Company not found')) // Company lookup fails
        .mockResolvedValueOnce({ data: { data: mockCompanyWithEmployees } }); // Employees still works

      const result = await client.getCompanyWithAllEmployees(companyIdentifier);

      expect(result.company).toEqual({
        id: '',
        name: 'nonexistent.com',
      });
      expect(result.employees).toEqual(mockCompanyWithEmployees);
    });
  });

  describe('error handling', () => {
    it('should handle API errors properly', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      mockCacheClient.getJson.mockResolvedValue(null);

      // Mock API error structure (not used directly but defines the expected format)
      const _apiError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {
            message: 'Company not found',
            code: 'COMPANY_NOT_FOUND',
          },
        },
        config: { url: '/employees/search' },
        message: 'Request failed with status code 404',
      };

      // Mock the interceptor behavior
      mockAxiosInstance.get.mockImplementation(() => {
        const transformedError = {
          message: 'Company not found',
          code: 'COMPANY_NOT_FOUND',
          statusCode: 404,
        };
        return Promise.reject(transformedError);
      });

      await expect(client.searchEmployees(query)).rejects.toEqual({
        message: 'Company not found',
        code: 'COMPANY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should handle network errors', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      mockCacheClient.getJson.mockResolvedValue(null);

      // Mock the interceptor behavior for network errors
      mockAxiosInstance.get.mockImplementation(() => {
        const transformedError = {
          message: 'Network Error',
          code: 'UNKNOWN_ERROR',
          statusCode: 500,
        };
        return Promise.reject(transformedError);
      });

      await expect(client.searchEmployees(query)).rejects.toEqual({
        message: 'Network Error',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
      });
    });
  });

  describe('caching options', () => {
    it('should skip cache when useCache is false', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockEmployeeSearchResponse },
      });

      await client.searchEmployees(query, { useCache: false });

      expect(mockCacheClient.getJson).not.toHaveBeenCalled();
      expect(mockCacheClient.setJson).not.toHaveBeenCalled();
    });

    it('should use custom cache TTL', async () => {
      const query = { company_name: 'TechCorp Inc.' };
      const customTtl = 1800; // 30 minutes

      mockCacheClient.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockEmployeeSearchResponse },
      });

      await client.searchEmployees(query, { cacheTtl: customTtl });

      expect(mockCacheClient.setJson).toHaveBeenCalledWith(
        expect.any(String),
        mockEmployeeSearchResponse,
        customTtl
      );
    });
  });
});
