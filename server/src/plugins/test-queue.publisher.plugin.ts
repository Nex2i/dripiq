import fp from 'fastify-plugin';
import { IS_PRODUCTION } from '@/config';
import { MessagePublisherService } from '@/modules/messages/publisher.service';

// TODO - Remove, testing logic only
function startTestQueuePublisher() {
  const interval = setInterval(async () => {
    try {
      await MessagePublisherService.publish({
        tenantId: 'test-tenant',
        userId: 'test-user',
        content: `Hello from server test publisher at ${new Date().toISOString()}`,
        metadata: { source: 'test-queue.publisher.plugin' },
      });
    } catch (err) {
      // Non-fatal test publisher error

      console.error('Test publisher failed to enqueue message', err);
    }
  }, 5000);

  return interval;
}

export default fp(async function testQueuePublisherPlugin(app) {
  if (IS_PRODUCTION) {
    app.log.info('Skipping test queue publisher in production');
    return;
  }

  const interval = startTestQueuePublisher();

  app.addHook('onClose', async () => {
    clearInterval(interval);
  });
});
