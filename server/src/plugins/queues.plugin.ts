import fp from 'fastify-plugin';
import { getQueueEvents, shutdownQueues } from '@/libs/bullmq';
import { QUEUE_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export default fp(async function queuesPlugin(app) {
  // Initialize queue events listeners for monitoring
  const leadAnalysisEvents = getQueueEvents(QUEUE_NAMES.lead_analysis);
  const campaignCreationEvents = getQueueEvents(QUEUE_NAMES.campaign_creation);

  // Set up event listeners for job failures
  leadAnalysisEvents.on('failed', ({ jobId, failedReason }) => {
    app.log.error({ jobId, failedReason }, 'Lead analysis job failed');
  });

  leadAnalysisEvents.on('completed', ({ jobId }) => {
    app.log.info({ jobId }, 'Lead analysis job completed');
  });

  campaignCreationEvents.on('failed', ({ jobId, failedReason }) => {
    app.log.error({ jobId, failedReason }, 'Campaign creation job failed');
  });

  campaignCreationEvents.on('completed', ({ jobId }) => {
    app.log.info({ jobId }, 'Campaign creation job completed');
  });

  logger.info('Queue workers and event listeners initialized', {
    workers: ['messages', 'lead_analysis', 'campaign_creation'],
  });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    logger.info('Shutting down queue workers and connections');

    await shutdownQueues();
  });
});
