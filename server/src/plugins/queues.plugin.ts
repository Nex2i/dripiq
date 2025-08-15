import fp from 'fastify-plugin';
import { getQueueEvents, shutdownQueues } from '@/libs/bullmq';
import { QUEUE_NAMES } from '@/constants/queues';

// Import workers
import { leadAnalysisWorker, campaignCreationWorker } from '@/workers';

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

  app.log.info('Queue workers and event listeners initialized', {
    workers: ['messages', 'lead_analysis', 'campaign_creation'],
  });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    app.log.info('Shutting down queue workers and connections');
    await Promise.all([leadAnalysisWorker.close(), campaignCreationWorker.close()]);
    await shutdownQueues();
  });
});
