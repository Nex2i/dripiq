import { FastifyInstance } from 'fastify';
import startServer from '@/app';
import { getWebDataService } from '@/libs/webData';

// Mock the webData service
jest.mock('@/libs/webData');
const mockGetWebDataService = getWebDataService as jest.MockedFunction<typeof getWebDataService>;

// Mock string extensions
jest.mock('@/extensions/string.extensions', () => {
  String.prototype.getFullDomain = function () {
    // Simple mock implementation
    return this.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  };
});

describe('/webdata/employees', () => {
  let app: FastifyInstance;
  let mockWebDataService: any;

  beforeAll(async () => {
    app = await startServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockWebDataService = {
      getEmployeesByCompanyDomain: jest.fn(),
    };
    mockGetWebDataService.mockReturnValue(mockWebDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /webdata/employees', () => {
    const mockEmployeeResponse = {
      company: {
        id: 'test-company',
        name: 'Test Company',
        domain: 'test.com',
      },
      employees: {
        current: [
          {
            id: '1',
            full_name: 'John Doe',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@test.com',
            job_title: 'CEO',
            company_name: 'Test Company',
          },
          {
            id: '2',
            full_name: 'Jane Smith',
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane@test.com',
            job_title: 'CTO',
            company_name: 'Test Company',
          },
        ],
        former: [],
        total_current: 2,
        total_former: 0,
      },
      provider: 'CoreSignal',
    };

    it('should successfully get employees for a domain', async () => {
      mockWebDataService.getEmployeesByCompanyDomain.mockResolvedValue(mockEmployeeResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/webdata/employees',
        payload: {
          domainUrl: 'https://www.test.com',
          isDecisionMaker: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);

      expect(data.success).toBe(true);
      expect(data.data.employees).toHaveLength(2);
      expect(data.data.total_count).toBe(2);
      expect(data.data.company_domain).toBe('test.com');
      expect(data.data.provider).toBe('CoreSignal');

      expect(mockWebDataService.getEmployeesByCompanyDomain).toHaveBeenCalledWith('test.com', {
        isDecisionMaker: true,
        useCache: true,
        cacheTtl: 3600,
      });
    });

    it('should use default isDecisionMaker value when not provided', async () => {
      mockWebDataService.getEmployeesByCompanyDomain.mockResolvedValue(mockEmployeeResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/webdata/employees',
        payload: {
          domainUrl: 'https://www.test.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockWebDataService.getEmployeesByCompanyDomain).toHaveBeenCalledWith('test.com', {
        isDecisionMaker: true, // default value
        useCache: true,
        cacheTtl: 3600,
      });
    });

    it('should handle isDecisionMaker set to false', async () => {
      mockWebDataService.getEmployeesByCompanyDomain.mockResolvedValue(mockEmployeeResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/webdata/employees',
        payload: {
          domainUrl: 'https://www.test.com',
          isDecisionMaker: false,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockWebDataService.getEmployeesByCompanyDomain).toHaveBeenCalledWith('test.com', {
        isDecisionMaker: false,
        useCache: true,
        cacheTtl: 3600,
      });
    });

    it('should return 400 for invalid domain URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webdata/employees',
        payload: {
          domainUrl: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid domain URL provided');
    });

    it('should handle service errors gracefully', async () => {
      mockWebDataService.getEmployeesByCompanyDomain.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/webdata/employees',
        payload: {
          domainUrl: 'https://www.test.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to retrieve employee data');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webdata/employees',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should clean domain URLs correctly', async () => {
      mockWebDataService.getEmployeesByCompanyDomain.mockResolvedValue(mockEmployeeResponse);

      const testCases = [
        { input: 'https://www.test.com/', expected: 'test.com' },
        { input: 'http://test.com', expected: 'test.com' },
        { input: 'www.test.com', expected: 'test.com' },
        { input: 'test.com', expected: 'test.com' },
      ];

      for (const testCase of testCases) {
        await app.inject({
          method: 'POST',
          url: '/webdata/employees',
          payload: {
            domainUrl: testCase.input,
          },
        });

        expect(mockWebDataService.getEmployeesByCompanyDomain).toHaveBeenCalledWith(
          testCase.expected,
          expect.any(Object)
        );
      }
    });
  });
});
