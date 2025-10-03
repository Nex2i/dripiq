import '@/extensions/string.extensions';

const mockHttpClient = {
  get: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockHttpClient),
}));

jest.mock('@/libs/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const originalEnv = process.env;
const mockApiKey = 'test-api-key-123';

process.env = { ...originalEnv };
process.env.EMAIL_LIST_VERIFY_API_KEY = mockApiKey;

import { logger } from '@/libs/logger';
import { emailListVerifyClient } from './emailListVerify.client';
import type { EmailListVerifyResponse } from './emailListVerify.client';

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('EmailListVerifyClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.EMAIL_LIST_VERIFY_API_KEY = mockApiKey;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should throw error when EMAIL_LIST_VERIFY_API_KEY is not set', () => {
      delete process.env.EMAIL_LIST_VERIFY_API_KEY;

      expect(() => {
        jest.isolateModules(() => {
          jest.doMock('axios', () => ({
            create: jest.fn(() => mockHttpClient),
          }));

          const module = require('./emailListVerify.client');
          return module;
        });
      }).toThrow();
    });

    it('should create axios client instance on module load', () => {
      expect(emailListVerifyClient).toBeDefined();
      expect(typeof emailListVerifyClient.verifyEmailDetailed).toBe('function');
      expect(typeof emailListVerifyClient.canSendEmail).toBe('function');
      expect(typeof emailListVerifyClient.isResultOk).toBe('function');
      expect(typeof emailListVerifyClient.mapResultToEmailVerificationResult).toBe('function');
    });
  });

  describe('verifyEmailDetailed', () => {
    it('should verify a valid email and return response', async () => {
      const testEmail = 'test@example.com';
      const mockResponse: EmailListVerifyResponse = {
        email: testEmail,
        result: 'ok',
        internalResult: 'ok',
        mxServer: 'mail.example.com',
        mxServerIp: '192.168.1.1',
        esp: 'Gmail',
        account: 'test',
        tag: null,
        isRole: false,
        isFree: false,
        isNoReply: false,
        firstName: 'Test',
        lastName: 'User',
        gender: 'unknown',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockResponse });

      const result = await emailListVerifyClient.verifyEmailDetailed(testEmail);

      expect(result).toEqual(mockResponse);
      expect(mockHttpClient.get).toHaveBeenCalledWith(`/verifyEmailDetailed?email=${testEmail}`);
    });

    it('should throw error for invalid email address', async () => {
      const invalidEmail = 'not-an-email';

      await expect(emailListVerifyClient.verifyEmailDetailed(invalidEmail)).rejects.toThrow(
        'EmailListVerifyClient:verifyEmailDetailed Invalid email address'
      );

      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    it('should throw error for empty email', async () => {
      const emptyEmail = '';

      await expect(emailListVerifyClient.verifyEmailDetailed(emptyEmail)).rejects.toThrow(
        'EmailListVerifyClient:verifyEmailDetailed Invalid email address'
      );

      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const testEmail = 'test@example.com';
      const mockError = new Error('API Error');
      mockHttpClient.get.mockRejectedValue(mockError);

      await expect(emailListVerifyClient.verifyEmailDetailed(testEmail)).rejects.toThrow(
        'API Error'
      );
    });

    it('should handle different verification results', async () => {
      const testEmail = 'test@example.com';
      const results = [
        'ok',
        'email_disabled',
        'dead_server',
        'invalid_mx',
        'disposable',
        'spamtrap',
        'ok_for_all',
        'smtp_protocol',
        'antispam_system',
        'unknown',
        'invalid_syntax',
      ] as const;

      for (const result of results) {
        const mockResponse: EmailListVerifyResponse = {
          email: testEmail,
          result,
          internalResult: result,
          mxServer: 'mail.example.com',
          mxServerIp: '192.168.1.1',
          esp: 'Gmail',
          account: 'test',
          tag: null,
          isRole: false,
          isFree: false,
          isNoReply: false,
          firstName: 'Test',
          lastName: 'User',
          gender: 'unknown',
        };

        mockHttpClient.get.mockResolvedValue({ data: mockResponse });

        const response = await emailListVerifyClient.verifyEmailDetailed(testEmail);

        expect(response.result).toBe(result);
      }
    });
  });

  describe('verifyEmailDetailedBatch', () => {
    it('should verify multiple emails and return results', async () => {
      const emails = ['test1@example.com', 'test2@example.com', 'test3@example.com'];
      const mockResponses: EmailListVerifyResponse[] = emails.map((email) => ({
        email,
        result: 'ok',
        internalResult: 'ok',
        mxServer: 'mail.example.com',
        mxServerIp: '192.168.1.1',
        esp: 'Gmail',
        account: email.split('@')[0] || '',
        tag: null,
        isRole: false,
        isFree: false,
        isNoReply: false,
        firstName: 'Test',
        lastName: 'User',
        gender: 'unknown',
      }));

      mockHttpClient.get.mockImplementation((url) => {
        const email = url.split('=')[1];
        const response = mockResponses.find((r) => r.email === email);
        return Promise.resolve({ data: response });
      });

      const results = await emailListVerifyClient.verifyEmailDetailedBatch(emails);

      expect(Object.keys(results)).toHaveLength(3);
      expect(results['test1@example.com']).toBe('ok');
      expect(results['test2@example.com']).toBe('ok');
      expect(results['test3@example.com']).toBe('ok');
    });

    it('should handle mix of successful and failed verifications', async () => {
      const emails = ['valid@example.com', 'invalid-email', 'test@example.com'];

      mockHttpClient.get.mockImplementation((url) => {
        const email = url.split('=')[1];
        if (email === 'valid@example.com') {
          return Promise.resolve({
            data: {
              email,
              result: 'ok',
              internalResult: 'ok',
              mxServer: 'mail.example.com',
              mxServerIp: '192.168.1.1',
              esp: 'Gmail',
              account: 'valid',
              tag: null,
              isRole: false,
              isFree: false,
              isNoReply: false,
              firstName: 'Valid',
              lastName: 'User',
              gender: 'unknown',
            },
          });
        } else if (email === 'test@example.com') {
          return Promise.resolve({
            data: {
              email,
              result: 'invalid_syntax',
              internalResult: 'invalid_syntax',
              mxServer: '',
              mxServerIp: '',
              esp: '',
              account: 'test',
              tag: null,
              isRole: false,
              isFree: false,
              isNoReply: false,
              firstName: '',
              lastName: '',
              gender: '',
            },
          });
        }
        return Promise.reject(new Error('Invalid email'));
      });

      const results = await emailListVerifyClient.verifyEmailDetailedBatch(emails);

      expect(results['valid@example.com']).toBe('ok');
      expect(results['test@example.com']).toBe('invalid_syntax');
      expect(results['invalid-email']).toBeUndefined();
      expect(mockedLogger.warn).toHaveBeenCalledWith('Email verification failed', {
        email: 'invalid-email',
        error: expect.any(Error),
        errorMessage: expect.any(String),
      });
    });

    it('should handle empty array', async () => {
      const results = await emailListVerifyClient.verifyEmailDetailedBatch([]);

      expect(results).toEqual({});
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    it('should log warnings for failed verifications', async () => {
      const emails = ['fail@example.com'];
      const mockError = new Error('Network error');

      mockHttpClient.get.mockRejectedValue(mockError);

      const results = await emailListVerifyClient.verifyEmailDetailedBatch(emails);

      expect(results).toEqual({});
      expect(mockedLogger.warn).toHaveBeenCalledWith('Email verification failed', {
        email: 'fail@example.com',
        error: mockError,
        errorMessage: 'Network error',
      });
    });

    it('should handle response with missing result field', async () => {
      const emails = ['test@example.com'];

      mockHttpClient.get.mockResolvedValue({
        data: {
          email: 'test@example.com',
          result: null,
          internalResult: '',
          mxServer: '',
          mxServerIp: '',
          esp: '',
          account: '',
          tag: null,
          isRole: false,
          isFree: false,
          isNoReply: false,
          firstName: '',
          lastName: '',
          gender: '',
        },
      });

      const results = await emailListVerifyClient.verifyEmailDetailedBatch(emails);

      expect(results).toEqual({});
    });
  });

  describe('canSendEmail', () => {
    it('should return true when email result is ok', async () => {
      const testEmail = 'test@example.com';
      const mockResponse: EmailListVerifyResponse = {
        email: testEmail,
        result: 'ok',
        internalResult: 'ok',
        mxServer: 'mail.example.com',
        mxServerIp: '192.168.1.1',
        esp: 'Gmail',
        account: 'test',
        tag: null,
        isRole: false,
        isFree: false,
        isNoReply: false,
        firstName: 'Test',
        lastName: 'User',
        gender: 'unknown',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockResponse });

      const result = await emailListVerifyClient.canSendEmail(testEmail);

      expect(result).toBe(true);
    });

    it('should return false when email result is not ok', async () => {
      const testEmail = 'test@example.com';
      const mockResponse: EmailListVerifyResponse = {
        email: testEmail,
        result: 'invalid_syntax',
        internalResult: 'invalid_syntax',
        mxServer: '',
        mxServerIp: '',
        esp: '',
        account: 'test',
        tag: null,
        isRole: false,
        isFree: false,
        isNoReply: false,
        firstName: '',
        lastName: '',
        gender: '',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockResponse });

      const result = await emailListVerifyClient.canSendEmail(testEmail);

      expect(result).toBe(false);
    });

    it('should return false for various invalid results', async () => {
      const testEmail = 'test@example.com';
      const invalidResults = [
        'email_disabled',
        'dead_server',
        'invalid_mx',
        'disposable',
        'spamtrap',
        'ok_for_all',
        'smtp_protocol',
        'antispam_system',
        'unknown',
        'invalid_syntax',
      ] as const;

      for (const result of invalidResults) {
        const mockResponse: EmailListVerifyResponse = {
          email: testEmail,
          result,
          internalResult: result,
          mxServer: '',
          mxServerIp: '',
          esp: '',
          account: 'test',
          tag: null,
          isRole: false,
          isFree: false,
          isNoReply: false,
          firstName: '',
          lastName: '',
          gender: '',
        };

        mockHttpClient.get.mockResolvedValue({ data: mockResponse });

        const canSend = await emailListVerifyClient.canSendEmail(testEmail);

        expect(canSend).toBe(false);
      }
    });
  });

  describe('isResultOk', () => {
    it('should return true when result is ok', () => {
      expect(emailListVerifyClient.isResultOk('ok')).toBe(true);
    });

    it('should return false for all other results', () => {
      const nonOkResults = [
        'email_disabled',
        'dead_server',
        'invalid_mx',
        'disposable',
        'spamtrap',
        'ok_for_all',
        'smtp_protocol',
        'antispam_system',
        'unknown',
        'invalid_syntax',
      ] as const;

      for (const result of nonOkResults) {
        expect(emailListVerifyClient.isResultOk(result)).toBe(false);
      }
    });
  });

  describe('mapResultToEmailVerificationResult', () => {
    it('should map ok to valid', () => {
      const result = emailListVerifyClient.mapResultToEmailVerificationResult('ok');
      expect(result).toBe('valid');
    });

    it('should map ok_for_all to ok_for_all', () => {
      const result = emailListVerifyClient.mapResultToEmailVerificationResult('ok_for_all');
      expect(result).toBe('ok_for_all');
    });

    it('should map invalid_syntax to invalid', () => {
      const result = emailListVerifyClient.mapResultToEmailVerificationResult('invalid_syntax');
      expect(result).toBe('invalid');
    });

    it('should map unknown to unknown', () => {
      const result = emailListVerifyClient.mapResultToEmailVerificationResult('unknown');
      expect(result).toBe('unknown');
    });

    it('should map all other results to invalid', () => {
      const otherResults = [
        'email_disabled',
        'dead_server',
        'invalid_mx',
        'disposable',
        'spamtrap',
        'smtp_protocol',
        'antispam_system',
      ] as const;

      for (const result of otherResults) {
        const mapped = emailListVerifyClient.mapResultToEmailVerificationResult(result);
        expect(mapped).toBe('invalid');
      }
    });

    it('should handle all possible EmailListVerifyResult values', () => {
      const allResults = [
        'ok',
        'email_disabled',
        'dead_server',
        'invalid_mx',
        'disposable',
        'spamtrap',
        'ok_for_all',
        'smtp_protocol',
        'antispam_system',
        'unknown',
        'invalid_syntax',
      ] as const;

      for (const result of allResults) {
        const mapped = emailListVerifyClient.mapResultToEmailVerificationResult(result);
        expect(['valid', 'invalid', 'unknown', 'ok_for_all']).toContain(mapped);
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: verify, check if can send, and map result', async () => {
      const testEmail = 'test@example.com';
      const mockResponse: EmailListVerifyResponse = {
        email: testEmail,
        result: 'ok',
        internalResult: 'ok',
        mxServer: 'mail.example.com',
        mxServerIp: '192.168.1.1',
        esp: 'Gmail',
        account: 'test',
        tag: null,
        isRole: false,
        isFree: false,
        isNoReply: false,
        firstName: 'Test',
        lastName: 'User',
        gender: 'unknown',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockResponse });

      const verifyResponse = await emailListVerifyClient.verifyEmailDetailed(testEmail);
      const canSend = await emailListVerifyClient.canSendEmail(testEmail);
      const mappedResult = emailListVerifyClient.mapResultToEmailVerificationResult(
        verifyResponse.result
      );

      expect(verifyResponse.result).toBe('ok');
      expect(canSend).toBe(true);
      expect(mappedResult).toBe('valid');
    });

    it('should handle batch verification with mixed results and mapping', async () => {
      const emails = ['valid@example.com', 'invalid@example.com', 'unknown@example.com'];

      mockHttpClient.get.mockImplementation((url) => {
        const email = url.split('=')[1];
        const resultMap: Record<string, any> = {
          'valid@example.com': 'ok',
          'invalid@example.com': 'invalid_syntax',
          'unknown@example.com': 'unknown',
        };

        return Promise.resolve({
          data: {
            email,
            result: resultMap[email],
            internalResult: resultMap[email],
            mxServer: 'mail.example.com',
            mxServerIp: '192.168.1.1',
            esp: 'Gmail',
            account: email.split('@')[0],
            tag: null,
            isRole: false,
            isFree: false,
            isNoReply: false,
            firstName: '',
            lastName: '',
            gender: '',
          },
        });
      });

      const batchResults = await emailListVerifyClient.verifyEmailDetailedBatch(emails);

      expect(batchResults['valid@example.com']).toBeDefined();
      expect(batchResults['invalid@example.com']).toBeDefined();
      expect(batchResults['unknown@example.com']).toBeDefined();

      expect(
        emailListVerifyClient.mapResultToEmailVerificationResult(batchResults['valid@example.com']!)
      ).toBe('valid');
      expect(
        emailListVerifyClient.mapResultToEmailVerificationResult(
          batchResults['invalid@example.com']!
        )
      ).toBe('invalid');
      expect(
        emailListVerifyClient.mapResultToEmailVerificationResult(
          batchResults['unknown@example.com']!
        )
      ).toBe('unknown');
    });
  });
});
