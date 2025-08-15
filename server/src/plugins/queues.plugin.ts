import fp from 'fastify-plugin';
import { getQueueEvents, shutdownQueues } from '@/libs/bullmq';
import { QUEUE_NAMES } from '@/constants/queues';

export default fp(async function queuesPlugin(app) {
  // Initialize queue events listeners (optional; useful for monitoring)
  const messagesEvents = getQueueEvents(QUEUE_NAMES.messages);
  messagesEvents.on('completed', ({ jobId }) => {
    app.log.info({ jobId }, 'Message job completed');
  });
  messagesEvents.on('failed', ({ jobId, failedReason }) => {
    app.log.error({ jobId, failedReason }, 'Message job failed');
  });

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await shutdownQueues();
  });
});