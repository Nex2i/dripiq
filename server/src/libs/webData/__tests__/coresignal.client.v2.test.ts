import { CoreSignalClient } from '../coresignal.client';
import { CacheClient } from '@/libs/cache-client';
import axios from 'axios';

// Mock dependencies
jest.mock('@/libs/cache-client');

jest.mock('@/libs/cache', () => ({
  cacheManager: {
    clear: jest.fn(),
    getStats: jest.fn().mockResolvedValue({
      keys: 0,
      memory: '1MB',
      hits: 0,
      misses: 0,
    }),
  },
}));
jest.mock('@/libs/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockCacheClient = CacheClient as jest.MockedClass<typeof CacheClient>;

// Import the mocked cache manager
const { cacheManager: mockCacheManager } = jest.requireMock('@/libs/cache');

describe('CoreSignalClient v2 Multi-Source', () => {
  let client: CoreSignalClient;
  let mockAxiosInstance: any;
  let mockCache: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Mock cache instance
    mockCache = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
    };

    mockCacheClient.mockImplementation(() => mockCache);

    // Set up environment
    process.env.CORESIGNAL_API_KEY = 'test-api-key';

    client = new CoreSignalClient();
  });

  afterEach(() => {
    delete process.env.CORESIGNAL_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.coresignal.com/cdapi/v2',
        headers: {
          apikey: 'test-api-key',
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });
    });

    it('should throw error if API key is missing', () => {
      delete process.env.CORESIGNAL_API_KEY;
      expect(() => new CoreSignalClient()).toThrow('CoreSignal API key is missing');
    });
  });

  describe('searchEmployeesByDomain', () => {
    const mockSearchResponse = [93486394, 327313517, 87115457];

    it('should search for employees with decision maker filter', async () => {
      mockCache.getJson.mockResolvedValue(null);
      mockAxiosInstance.post.mockResolvedValue({ data: mockSearchResponse });

      const result = await client.searchEmployeesByDomain('leventhal-law.com', {
        isDecisionMaker: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/employee_multi_source/search/es_dsl', {
        query: {
          bool: {
            must: [
              {
                term: {
                  is_decision_maker: 1,
                },
              },
              {
                term: {
                  is_working: 1,
                },
              },
              {
                nested: {
                  path: 'experience',
                  query: {
                    bool: {
                      must: [
                        {
                          term: {
                            'experience.active_experience': 1,
                          },
                        },
                        {
                          match: {
                            'experience.company_website.domain_only': 'leventhal-law.com',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      });

      expect(result).toEqual(mockSearchResponse);
    });

    it('should search for employees without decision maker filter', async () => {
      mockCache.getJson.mockResolvedValue(null);
      mockAxiosInstance.post.mockResolvedValue({ data: mockSearchResponse });

      await client.searchEmployeesByDomain('leventhal-law.com', {
        isDecisionMaker: false,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/employee_multi_source/search/es_dsl', {
        query: {
          bool: {
            must: [
              {
                term: {
                  is_working: 1,
                },
              },
              {
                nested: {
                  path: 'experience',
                  query: {
                    bool: {
                      must: [
                        {
                          term: {
                            'experience.active_experience': 1,
                          },
                        },
                        {
                          match: {
                            'experience.company_website.domain_only': 'leventhal-law.com',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      });
    });

    it('should use cache when available', async () => {
      const cachedResult = [123, 456];
      mockCache.getJson.mockResolvedValue(cachedResult);

      const result = await client.searchEmployeesByDomain('leventhal-law.com');

      expect(result).toEqual(cachedResult);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });
  });

  describe('collectEmployeeById', () => {
    const mockEmployeeResponse = {
      id: 327313517,
      full_name: 'Jim Leventhal',
      first_name: 'Jim',
      last_name: 'Leventhal',
      primary_professional_email: 'jim@leventhal-law.com',
      linkedin_url: 'https://www.linkedin.com/in/jim-leventhal-8129a4108',
      active_experience_title: 'Senior Managing Partner',
      location_country: 'United States',
      inferred_skills: ['injury', 'law', 'medical malpractice'],
      experience: [],
      education: [],
      created_at: '2016-09-21T13:42:46.000Z',
      updated_at: '2025-08-13T08:12:24.132211Z',
    };

    it('should collect employee data by ID', async () => {
      mockCache.getJson.mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue({ data: mockEmployeeResponse });

      const result = await client.collectEmployeeById(327313517);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/employee_multi_source/collect/327313517'
      );
      expect(result).toEqual(mockEmployeeResponse);
    });

    it('should use cache when available', async () => {
      mockCache.getJson.mockResolvedValue(mockEmployeeResponse);

      const result = await client.collectEmployeeById(327313517);

      expect(result).toEqual(mockEmployeeResponse);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('getEmployeesByCompanyDomain', () => {
    const mockSearchResponse = [327313517, 93486394];
    const mockEmployee1 = {
      id: 327313517,
      full_name: 'Jim Leventhal',
      first_name: 'Jim',
      last_name: 'Leventhal',
    };
    const mockEmployee2 = {
      id: 93486394,
      full_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
    };

    it('should search and collect employees', async () => {
      mockCache.getJson.mockResolvedValue(null);
      mockAxiosInstance.post.mockResolvedValue({ data: mockSearchResponse });
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockEmployee1 })
        .mockResolvedValueOnce({ data: mockEmployee2 });

      const result = await client.getEmployeesByCompanyDomain('leventhal-law.com');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockEmployee1);
      expect(result[1]).toEqual(mockEmployee2);
    });

    it('should return empty array when no employees found', async () => {
      mockCache.getJson.mockResolvedValue(null);
      mockAxiosInstance.post.mockResolvedValue({ data: [] });

      const result = await client.getEmployeesByCompanyDomain('nonexistent.com');

      expect(result).toEqual([]);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should handle individual employee collection failures gracefully', async () => {
      mockCache.getJson.mockResolvedValue(null);
      mockAxiosInstance.post.mockResolvedValue({ data: mockSearchResponse });
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockEmployee1 })
        .mockRejectedValueOnce(new Error('Employee not found'));

      const result = await client.getEmployeesByCompanyDomain('leventhal-law.com');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockEmployee1);
    });
  });

  describe('cache operations', () => {
    it('should clear cache', async () => {
      await client.clearCache('pattern');
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should get cache stats', async () => {
      const mockStats = { keys: 100, memory: '1MB', hits: 10, misses: 5 };
      mockCacheManager.getStats.mockResolvedValue(mockStats);

      const result = await client.getCacheStats();
      expect(result).toEqual({
        hits: 10,
        misses: 5,
        size: 100,
      });
    });
  });
});
