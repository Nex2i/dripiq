import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { LEAD_STATUS } from '@/constants/leadStatus.constants';
import { logger } from '@/libs/logger';
import { updateLeadStatuses } from '@/modules/lead.service';
import { SiteScrapeService } from '@/modules/ai/siteScrape.service';
import { firecrawlTypes } from '@/libs/firecrawl/firecrawl.metadata';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import type {
  LeadInitialProcessingJobPayload,
  LeadInitialProcessingJobResult,
} from './lead-initial-processing.types';

async function processLeadInitialProcessing(
  job: Job<LeadInitialProcessingJobPayload>
): Promise<LeadInitialProcessingJobResult> {
  const { tenantId, leadId, leadUrl, metadata = {} } = job.data;

  try {
    logger.info('[LeadInitialProcessingWorker] Starting initial processing', {
      jobId: job.id,
      tenantId,
      leadId,
      leadUrl,
    });

    // Update status to Initial Processing
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.INITIAL_PROCESSING],
      [LEAD_STATUS.UNPROCESSED]
    );

    // Step 1: Get sitemap
    let siteMap: string[];
    try {
      siteMap = await firecrawlClient.getSiteMap(leadUrl.cleanWebsiteUrl());
      logger.info('[LeadInitialProcessingWorker] Sitemap retrieved', {
        jobId: job.id,
        leadId,
        sitemapSize: siteMap.length,
      });
    } catch (error) {
      logger.error('[LeadInitialProcessingWorker] Failed to get sitemap', {
        jobId: job.id,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to retrieve sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Step 2: Filter URLs (basic filtering)
    const filteredUrls = filterUrls(siteMap);
    logger.info('[LeadInitialProcessingWorker] URLs filtered', {
      jobId: job.id,
      leadId,
      originalCount: siteMap.length,
      filteredCount: filteredUrls.length,
    });

    // Step 3: Smart filter sitemap
    let smartFilteredUrls: string[];
    try {
      smartFilteredUrls = await SiteScrapeService.smartFilterSiteMap(filteredUrls, 'lead_site');
      logger.info('[LeadInitialProcessingWorker] Smart filter applied', {
        jobId: job.id,
        leadId,
        filteredCount: filteredUrls.length,
        smartFilteredCount: smartFilteredUrls.length,
      });
    } catch (error) {
      logger.warn('[LeadInitialProcessingWorker] Smart filter failed, using basic filtered URLs', {
        jobId: job.id,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      smartFilteredUrls = filteredUrls;
    }

    // Step 4: Update status to Syncing Site
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.SYNCING_SITE],
      [LEAD_STATUS.INITIAL_PROCESSING]
    );

    // Step 5: Trigger batch scrape
    const batchMetadata = {
      leadId,
      tenantId,
      type: firecrawlTypes.lead_site,
      ...metadata,
    };

    let batchScrapeJobId: string | undefined;
    try {
      await firecrawlClient.batchScrapeUrls(smartFilteredUrls, batchMetadata);
      logger.info('[LeadInitialProcessingWorker] Batch scrape initiated', {
        jobId: job.id,
        leadId,
        urlCount: smartFilteredUrls.length,
      });
    } catch (error) {
      logger.error('[LeadInitialProcessingWorker] Failed to initiate batch scrape', {
        jobId: job.id,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to initiate batch scrape: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    logger.info('[LeadInitialProcessingWorker] Initial processing completed successfully', {
      jobId: job.id,
      tenantId,
      leadId,
      finalUrlCount: smartFilteredUrls.length,
    });

    return {
      success: true,
      leadId,
      sitemapUrls: siteMap,
      filteredUrls: smartFilteredUrls,
      batchScrapeJobId,
    };
  } catch (error) {
    logger.error('[LeadInitialProcessingWorker] Initial processing failed', {
      jobId: job.id,
      tenantId,
      leadId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update status back to unprocessed on failure
    try {
      await updateLeadStatuses(
        tenantId,
        leadId,
        [LEAD_STATUS.UNPROCESSED],
        [LEAD_STATUS.INITIAL_PROCESSING, LEAD_STATUS.SYNCING_SITE]
      );
    } catch (statusError) {
      logger.error('[LeadInitialProcessingWorker] Failed to update status after error', {
        jobId: job.id,
        leadId,
        statusError: statusError instanceof Error ? statusError.message : 'Unknown error',
      });
    }

    // Determine error code
    let errorCode: LeadInitialProcessingJobResult['errorCode'] = 'UNKNOWN';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('sitemap')) {
      errorCode = 'SITEMAP_FETCH_FAILED';
    } else if (errorMessage.includes('batch scrape')) {
      errorCode = 'BATCH_SCRAPE_FAILED';
    } else if (errorMessage.includes('filter')) {
      errorCode = 'SMART_FILTER_FAILED';
    }

    return {
      success: false,
      leadId,
      error: errorMessage,
      errorCode,
    };
  }
}

// Helper function from SiteScrapeService
const excludePathPattern = [
  '^/blog(?:/.*)?$',
  '^/support(?:/.*)?$',
  '^/privacy(?:-policy)?(?:/.*)?$',
  '^/terms(?:-of-(service|use|conditions))?(?:/.*)?$',
  '^/(careers?|jobs)(?:/.*)?$',
  '^/wp-content(?:/.*)?$',
  '^/wp-includes(?:/.*)?$',
  '^/wp-admin(?:/.*)?$',
  '^/wp-login(?:/.*)?$',
  '^/wp-register(?:/.*)?$',
  '^/wp-trackback(?:/.*)?$',
  '^/wp-json(?:/.*)?$',
  '^/wp-jsonp(?:/.*)?$',
].join('|');
const excludeRegex = new RegExp(excludePathPattern, 'i');

function filterUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      const { pathname } = new URL(url);
      return !excludeRegex.test(pathname);
    } catch {
      return false;
    }
  });
}

const leadInitialProcessingWorker = getWorker<
  LeadInitialProcessingJobPayload,
  LeadInitialProcessingJobResult
>(
  QUEUE_NAMES.lead_initial_processing,
  async (job: Job<LeadInitialProcessingJobPayload>) => {
    if (job.name !== JOB_NAMES.lead_initial_processing.process) {
      logger.warn('[LeadInitialProcessingWorker] Skipping unexpected job name', {
        jobId: job.id,
        jobName: job.name,
      });
      return {
        success: false,
        leadId: job.data.leadId,
        error: 'Unexpected job name',
        errorCode: 'UNKNOWN',
      };
    }

    return processLeadInitialProcessing(job);
  },
  {
    concurrency: 3, // Allow multiple leads to be processed concurrently
  }
);

export default leadInitialProcessingWorker;
