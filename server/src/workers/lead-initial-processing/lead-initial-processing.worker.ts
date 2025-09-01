import type { Job } from 'bullmq';
import { SearchResultWeb } from '@mendable/firecrawl-js';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { LEAD_STATUS } from '@/constants/leadStatus.constants';
import { logger } from '@/libs/logger';
import { updateLeadStatuses } from '@/modules/lead.service';
import { SiteScrapeService } from '@/modules/ai/siteScrape.service';
import { firecrawlTypes } from '@/libs/firecrawl/firecrawl.metadata';
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

    const batchMetadata = {
      leadId,
      tenantId,
      type: firecrawlTypes.lead_site,
      ...metadata,
    };

    let result;
    try {
      result = await SiteScrapeService.scrapeSiteWithCallbacks(
        leadUrl,
        batchMetadata,
        'lead_site',
        {
          onSitemapRetrieved: async (siteMap: SearchResultWeb[]) => {
            logger.info('[LeadInitialProcessingWorker] Sitemap retrieved', {
              jobId: job.id,
              leadId,
              sitemapSize: siteMap.length,
            });
          },
          onUrlsFiltered: async (basicFiltered: SearchResultWeb[], smartFiltered: string[]) => {
            logger.info('[LeadInitialProcessingWorker] URL filtering completed', {
              jobId: job.id,
              leadId,
              originalCount: basicFiltered.length,
              smartFilteredCount: smartFiltered.length,
            });
          },
          onBatchScrapeInitiated: async () => {
            await updateLeadStatuses(
              tenantId,
              leadId,
              [LEAD_STATUS.SYNCING_SITE],
              [LEAD_STATUS.INITIAL_PROCESSING]
            );
            logger.info('[LeadInitialProcessingWorker] Batch scrape initiated', {
              jobId: job.id,
              leadId,
            });
          },
        }
      );
    } catch (error) {
      logger.error('[LeadInitialProcessingWorker] Site scraping failed', {
        jobId: job.id,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Determine specific error type for better error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('sitemap')) {
        throw new Error(`Failed to retrieve sitemap: ${errorMessage}`);
      } else if (errorMessage.includes('batch scrape')) {
        throw new Error(`Failed to initiate batch scrape: ${errorMessage}`);
      } else if (errorMessage.includes('filter')) {
        throw new Error(`Failed to filter URLs: ${errorMessage}`);
      } else {
        throw error;
      }
    }

    const { siteMap, smartFilteredUrls } = result;

    logger.info('[LeadInitialProcessingWorker] Initial processing completed successfully', {
      jobId: job.id,
      tenantId,
      leadId,
      finalUrlCount: smartFilteredUrls.length,
    });

    return {
      success: true,
      leadId,
      sitemapUrls: siteMap.map((url) => url.url),
      filteredUrls: smartFilteredUrls,
      batchScrapeJobId: undefined, // batchScrapeJobId is handled internally by the service
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
