import type { Job } from 'bullmq';
import { SearchResultWeb } from '@mendable/firecrawl-js';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { LEAD_STATUS } from '@/constants/leadStatus.constants';
import { logger } from '@/libs/logger';
import { updateLeadStatuses } from '@/modules/lead.service';
import { SiteScrapeService } from '@/modules/ai/siteScrape.service';
import { EmbeddingsService } from '@/modules/ai/embeddings.service';
import { LeadAnalysisPublisher } from '@/modules/messages/leadAnalysis.publisher.service';
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
  const isResync = metadata.isResync === 'true';

  try {
    logger.info(
      `[LeadInitialProcessingWorker] Starting ${isResync ? 'resync' : 'initial'} processing`,
      {
        jobId: job.id,
        tenantId,
        leadId,
        leadUrl,
        isResync,
        triggeredBy: metadata.triggeredBy,
      }
    );

    // Update status to Initial Processing
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.INITIAL_PROCESSING],
      [LEAD_STATUS.UNPROCESSED, LEAD_STATUS.PROCESSED] // For resync, we might be starting from PROCESSED status
    );

    // Check if site was recently scraped (within 2 weeks)
    const domain = leadUrl.getFullDomain();
    const lastScrapeDate = await EmbeddingsService.getDateOfLastDomainScrape(domain);
    const recentScrapeThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 2 weeks ago

    if (lastScrapeDate && lastScrapeDate > recentScrapeThreshold) {
      logger.info(
        `[LeadInitialProcessingWorker] Site was recently scraped, skipping scraping and triggering analysis directly`,
        {
          jobId: job.id,
          leadId,
          domain,
          lastScrapeDate: lastScrapeDate.toISOString(),
          isResync,
        }
      );

      // Update status to processed and trigger lead analysis directly
      await updateLeadStatuses(
        tenantId,
        leadId,
        [LEAD_STATUS.PROCESSED],
        [LEAD_STATUS.INITIAL_PROCESSING]
      );

      // Trigger lead analysis directly
      await LeadAnalysisPublisher.publish({
        tenantId,
        leadId,
        metadata: {
          ...metadata,
          skippedScraping: true,
          lastScrapeDate: lastScrapeDate.toISOString(),
          triggeredFromWorker: true,
        },
      });

      logger.info(
        `[LeadInitialProcessingWorker] ${isResync ? 'Resync' : 'Initial'} processing completed (skipped scraping)`,
        {
          jobId: job.id,
          tenantId,
          leadId,
          skippedScraping: true,
          isResync,
        }
      );

      return {
        success: true,
        leadId,
        sitemapUrls: [],
        filteredUrls: [],
        batchScrapeJobId: undefined,
        skippedScraping: true,
      };
    }

    logger.info(
      `[LeadInitialProcessingWorker] ${isResync ? 'Resync requested' : 'Site not recently scraped'}, proceeding with scraping`,
      {
        jobId: job.id,
        leadId,
        domain,
        lastScrapeDate: lastScrapeDate?.toISOString() || 'never',
        isResync,
      }
    );

    const batchMetadata = {
      leadId,
      tenantId,
      type: firecrawlTypes.lead_site,
      ...metadata,
      isResync: isResync.toString(),
    };

    // Get sitemap
    let siteMap: SearchResultWeb[];
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

    // Apply basic URL filtering
    const basicFilteredUrls = SiteScrapeService.filterUrls(siteMap);
    logger.info('[LeadInitialProcessingWorker] Basic URL filtering applied', {
      jobId: job.id,
      leadId,
      originalCount: siteMap.length,
      basicFilteredCount: basicFilteredUrls.length,
    });

    // Apply smart filtering
    let smartFilteredUrls: string[];
    try {
      smartFilteredUrls = await SiteScrapeService.smartFilterSiteMap(
        basicFilteredUrls,
        'lead_site',
        {
          tenantId,
          userId: leadId, // Using leadId as identifier for this context
          domain,
        }
      );
      logger.info('[LeadInitialProcessingWorker] Smart filter applied', {
        jobId: job.id,
        leadId,
        basicFilteredCount: basicFilteredUrls.length,
        smartFilteredCount: smartFilteredUrls.length,
      });
    } catch (error) {
      logger.error(
        '[LeadInitialProcessingWorker] Smart filter failed, using basic filtered URLs with max limit',
        {
          jobId: job.id,
          leadId,
          error,
          basicFilteredCount: basicFilteredUrls.length,
        }
      );
    }

    // Update status to syncing site
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.SYNCING_SITE],
      [LEAD_STATUS.INITIAL_PROCESSING]
    );

    // Initiate batch scraping
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

    logger.info(
      `[LeadInitialProcessingWorker] ${isResync ? 'Resync' : 'Initial'} processing completed successfully`,
      {
        jobId: job.id,
        tenantId,
        leadId,
        finalUrlCount: smartFilteredUrls.length,
        isResync,
      }
    );

    return {
      success: true,
      leadId,
      sitemapUrls: siteMap.map((url) => url.url),
      filteredUrls: smartFilteredUrls,
      batchScrapeJobId: undefined, // batchScrapeJobId is handled internally by the service
      skippedScraping: false,
    };
  } catch (error) {
    logger.error(
      `[LeadInitialProcessingWorker] ${isResync ? 'Resync' : 'Initial'} processing failed`,
      {
        jobId: job.id,
        tenantId,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isResync,
      }
    );

    // Update status back to unprocessed on failure
    try {
      await updateLeadStatuses(
        tenantId,
        leadId,
        [LEAD_STATUS.UNPROCESSED, LEAD_STATUS.INITIAL_PROCESSING_FAILED],
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

    logger.error(
      `[LeadInitialProcessingWorker] ${isResync ? 'Resync' : 'Initial'} processing failed`,
      {
        jobId: job.id,
        tenantId,
        leadId,
        errorCode,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isResync,
      }
    );

    throw error;
  }
}

const leadInitialProcessingWorker = getWorker<
  LeadInitialProcessingJobPayload,
  LeadInitialProcessingJobResult
>(QUEUE_NAMES.lead_initial_processing, async (job: Job<LeadInitialProcessingJobPayload>) => {
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
      skippedScraping: false,
    };
  }

  return processLeadInitialProcessing(job);
});

export default leadInitialProcessingWorker;
