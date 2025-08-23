import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { logger } from '@/libs/logger';

// Hardcoded API key for bulk campaign endpoint
const BULK_CAMPAIGN_API_KEY = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';

const bulkCampaignAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // Add a preHandler hook to validate API key for bulk campaign routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Only apply this authentication to bulk campaign routes
    if (request.url.startsWith('/api/bulk-campaign')) {
      const authHeader = request.headers['x-api-key'];

      if (!authHeader || typeof authHeader !== 'string') {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid x-api-key header',
        });
      }

      if (authHeader !== BULK_CAMPAIGN_API_KEY) {
        logger.warn('Invalid API key attempt for bulk campaign endpoint', {
          providedKey: authHeader,
          url: request.url,
          ip: request.ip,
        });
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      logger.info('Valid API key authentication for bulk campaign endpoint', {
        url: request.url,
        ip: request.ip,
      });
    }
  });
};

export default fastifyPlugin(bulkCampaignAuthPlugin);
