import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import { LeadAnalyzerService } from '@/modules/ai/leadAnalyzer.service';
import {
  CampaignCreationPublisher,
  type CampaignCreationJobPayload,
} from './campaignCreation.publisher.service';
import type { LeadAnalysisJobPayload } from './leadAnalysis.publisher.service';

export type LeadAnalysisJobResult = {
  success: boolean;
  contactsFound: number;
  campaignJobsCreated: number;
  error?: string;
};

async function processLeadAnalysis(
  job: Job<LeadAnalysisJobPayload>
): Promise<LeadAnalysisJobResult> {
  const { tenantId, leadId, metadata } = job.data;

  try {
    logger.info('[LeadAnalysisWorker] Processing lead analysis', {
      jobId: job.id,
      tenantId,
      leadId,
    });

    // Run the lead analysis
    const analysisResult = await LeadAnalyzerService.analyze(tenantId, leadId);

    logger.info('[LeadAnalysisWorker] Lead analysis completed', {
      jobId: job.id,
      tenantId,
      leadId,
      contactsFound: analysisResult.contactsFound.length,
      contactsCreated: analysisResult.contactsCreated,
      siteAnalysisSuccess: analysisResult.siteAnalysisSuccess,
      contactExtractionSuccess: analysisResult.contactExtractionSuccess,
    });

    // Create campaign creation jobs for each contact found
    const campaignJobs: CampaignCreationJobPayload[] = analysisResult.contactsFound.map(
      (contact) => ({
        tenantId,
        leadId,
        contactId: contact.id,
        userId: undefined, // Automated creation, no specific user
        metadata: {
          ...metadata,
          automatedCreation: true,
          parentJobId: job.id,
        },
      })
    );

    let campaignJobsCreated = 0;
    if (campaignJobs.length > 0) {
      try {
        await CampaignCreationPublisher.publishBatch(campaignJobs);
        campaignJobsCreated = campaignJobs.length;

        logger.info('[LeadAnalysisWorker] Published campaign creation jobs', {
          jobId: job.id,
          tenantId,
          leadId,
          campaignJobsCount: campaignJobsCreated,
        });
      } catch (publishError) {
        logger.error('[LeadAnalysisWorker] Failed to publish campaign creation jobs', {
          jobId: job.id,
          tenantId,
          leadId,
          error: publishError instanceof Error ? publishError.message : 'Unknown error',
        });
        // Don't fail the entire job if campaign publishing fails
        // The lead analysis was successful
      }
    }

    return {
      success: true,
      contactsFound: analysisResult.contactsFound.length,
      campaignJobsCreated,
    };
  } catch (error) {
    logger.error('[LeadAnalysisWorker] Lead analysis failed', {
      jobId: job.id,
      tenantId,
      leadId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      contactsFound: 0,
      campaignJobsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const leadAnalysisWorker = getWorker<LeadAnalysisJobPayload, LeadAnalysisJobResult>(
  QUEUE_NAMES.lead_analysis,
  async (job: Job<LeadAnalysisJobPayload>) => {
    if (job.name !== JOB_NAMES.lead_analysis.process) {
      logger.warn('[LeadAnalysisWorker] Skipping unexpected job name', {
        jobId: job.id,
        jobName: job.name,
      });
      return {
        success: false,
        contactsFound: 0,
        campaignJobsCreated: 0,
        error: 'Unexpected job name',
      };
    }

    return processLeadAnalysis(job);
  },
  {
    concurrency: 2, // Limit concurrency for AI-intensive operations
  }
);

export default leadAnalysisWorker;
