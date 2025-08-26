import type { Job } from 'bullmq';
import { getWorker } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';
import type { CampaignExecutionJobPayload } from '@/modules/messages/campaignExecution.publisher.service';
import type { TimeoutJobPayload } from '@/types/timeout.types';
import {
  CampaignExecutionService,
  type CampaignExecutionJobResult,
} from './campaign-execution.service';
import { TimeoutExecutionService, type TimeoutJobResult } from './timeout-execution.service';

async function processCampaignExecution(
  job: Job<CampaignExecutionJobPayload>
): Promise<CampaignExecutionJobResult> {
  const campaignExecutionService = new CampaignExecutionService();
  return await campaignExecutionService.processCampaignExecution(job);
}

async function processTimeout(job: Job<TimeoutJobPayload>): Promise<TimeoutJobResult> {
  const timeoutExecutionService = new TimeoutExecutionService();
  return await timeoutExecutionService.processTimeout(job);
}

const campaignExecutionWorker = getWorker<
  CampaignExecutionJobPayload | TimeoutJobPayload,
  CampaignExecutionJobResult | TimeoutJobResult
>(
  QUEUE_NAMES.campaign_execution,
  async (job: Job<CampaignExecutionJobPayload | TimeoutJobPayload>) => {
    logger.info('[CampaignExecutionWorker] Processing job', {
      jobId: job.id,
      jobName: job.name,
      expectedNames: [
        JOB_NAMES.campaign_execution.initialize,
        JOB_NAMES.campaign_execution.timeout,
      ],
    });

    if (job.name === JOB_NAMES.campaign_execution.initialize) {
      return processCampaignExecution(job as Job<CampaignExecutionJobPayload>);
    } else if (job.name === JOB_NAMES.campaign_execution.timeout) {
      return processTimeout(job as Job<TimeoutJobPayload>);
    } else {
      logger.warn('[CampaignExecutionWorker] Skipping unexpected job name', {
        jobId: job.id,
        jobName: job.name,
        expectedNames: [
          JOB_NAMES.campaign_execution.initialize,
          JOB_NAMES.campaign_execution.timeout,
        ],
        jobData: JSON.stringify(job.data),
      });
      return {
        success: false,
        error: `Unexpected job name: ${job.name}`,
      };
    }
  }
);

export default campaignExecutionWorker;
export type { CampaignExecutionJobResult, TimeoutJobResult };
