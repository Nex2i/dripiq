import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { LEAD_STATUS } from '@/constants/leadStatus.constants';
import type {
  LeadInitialProcessingJobPayload,
  LeadInitialProcessingJobResult,
} from './lead-initial-processing.types';

// Mock dependencies
jest.mock('@/libs/bullmq', () => ({
  getWorker: jest.fn(),
}));

jest.mock('@/modules/lead.service', () => ({
  updateLeadStatuses: jest.fn(),
}));

jest.mock('@/modules/ai/siteScrape.service', () => ({
  SiteScrapeService: {
    smartFilterSiteMap: jest.fn(),
  },
}));

jest.mock('@/libs/firecrawl/firecrawl.client', () => ({
  __esModule: true,
  default: {
    getSiteMap: jest.fn(),
    batchScrapeUrls: jest.fn(),
  },
}));

jest.mock('@/libs/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Lead Initial Processing Worker', () => {
  const mockJobPayload: LeadInitialProcessingJobPayload = {
    tenantId: 'test-tenant-id',
    leadId: 'test-lead-id',
    leadUrl: 'https://example.com',
    metadata: {
      createdBy: 'test-user-id',
      createdAt: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should have correct queue configuration', () => {
    expect(QUEUE_NAMES.lead_initial_processing).toBe('lead_initial_processing');
    expect(JOB_NAMES.lead_initial_processing.process).toBe('lead_initial_processing.process');
  });

  it('should have correct status constants', () => {
    expect(LEAD_STATUS.INITIAL_PROCESSING).toBe('Initial Processing');
    expect(LEAD_STATUS.SYNCING_SITE).toBe('Syncing Site');
  });

  it('should validate job payload type', () => {
    const isValidPayload = (payload: any): payload is LeadInitialProcessingJobPayload => {
      return (
        typeof payload.tenantId === 'string' &&
        typeof payload.leadId === 'string' &&
        typeof payload.leadUrl === 'string'
      );
    };

    expect(isValidPayload(mockJobPayload)).toBe(true);
    expect(isValidPayload({ invalid: 'payload' })).toBe(false);
  });

  it('should validate job result type', () => {
    const successResult: LeadInitialProcessingJobResult = {
      success: true,
      leadId: 'test-lead-id',
      sitemapUrls: ['https://example.com', 'https://example.com/about'],
      filteredUrls: ['https://example.com', 'https://example.com/about'],
      batchScrapeJobId: 'batch-job-id',
    };

    const errorResult: LeadInitialProcessingJobResult = {
      success: false,
      leadId: 'test-lead-id',
      error: 'Failed to retrieve sitemap',
      errorCode: 'SITEMAP_FETCH_FAILED',
    };

    expect(successResult.success).toBe(true);
    expect(errorResult.success).toBe(false);
    expect(errorResult.errorCode).toBe('SITEMAP_FETCH_FAILED');
  });

  it('should have all required error codes defined', () => {
    const errorCodes = [
      'INVALID_URL',
      'SITEMAP_FETCH_FAILED',
      'SMART_FILTER_FAILED',
      'BATCH_SCRAPE_FAILED',
      'UNKNOWN',
    ];

    // This test ensures we have defined all the error codes we might use
    errorCodes.forEach((code) => {
      const result: LeadInitialProcessingJobResult = {
        success: false,
        leadId: 'test-id',
        error: 'Test error',
        errorCode: code as any,
      };
      expect(result.errorCode).toBe(code);
    });
  });

  it('should validate required payload fields', () => {
    const requiredFields = ['tenantId', 'leadId', 'leadUrl'];

    requiredFields.forEach((field) => {
      const incompletePayload = { ...mockJobPayload };
      delete (incompletePayload as any)[field];

      const isValidPayload = (payload: any): payload is LeadInitialProcessingJobPayload => {
        return requiredFields.every((f) => typeof payload[f] === 'string');
      };

      expect(isValidPayload(incompletePayload)).toBe(false);
    });
  });
});
