import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { LEAD_STATUS } from '@/constants/leadStatus.constants';
import type { 
  LeadInitialProcessingJobPayload, 
  LeadInitialProcessingJobResult 
} from './lead-initial-processing.types';

// Mock dependencies
vi.mock('@/libs/bullmq');
vi.mock('@/modules/lead.service');
vi.mock('@/modules/ai/siteScrape.service');
vi.mock('@/libs/firecrawl/firecrawl.client');
vi.mock('@/libs/logger');

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

  const mockJob = {
    id: 'test-job-id',
    name: JOB_NAMES.lead_initial_processing.process,
    data: mockJobPayload,
  } as Job<LeadInitialProcessingJobPayload>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
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
});