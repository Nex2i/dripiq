import fp from 'fastify-plugin';
import { getQueueEvents, shutdownQueues } from '@/libs/bullmq';
import { QUEUE_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export default fp(async function queuesPlugin(app) {
  // Initialize queue events listeners for monitoring
  const leadInitialProcessingEvents = getQueueEvents(QUEUE_NAMES.lead_initial_processing);
  const leadAnalysisEvents = getQueueEvents(QUEUE_NAMES.lead_analysis);
  const campaignCreationEvents = getQueueEvents(QUEUE_NAMES.campaign_creation);

  // Set up event listeners for job failures
  leadInitialProcessingEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('Lead initial processing job failed', { jobId, failedReason });
  });

  leadInitialProcessingEvents.on('completed', ({ jobId }) => {
    logger.info('Lead initial processing job completed', { jobId });
  });

  leadAnalysisEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('Lead analysis job failed', { jobId, failedReason });
  });

  leadAnalysisEvents.on('completed', ({ jobId }) => {
    logger.info('Lead analysis job completed', { jobId });
  });

  campaignCreationEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('Campaign creation job failed', { jobId, failedReason });
  });

  campaignCreationEvents.on('completed', ({ jobId }) => {
    logger.info('Campaign creation job completed', { jobId });
  });

  logger.info('Queue workers and event listeners initialized', {
    workers: ['messages', 'lead_initial_processing', 'lead_analysis', 'campaign_creation'],
  });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    logger.info('Shutting down queue workers and connections');

    await shutdownQueues();
  });
});
