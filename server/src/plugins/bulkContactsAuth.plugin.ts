import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { logger } from '@/libs/logger';

// Hardcoded GUID for API key authentication
const BULK_CONTACTS_API_KEY = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const bulkContactsAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // Add a preHandler hook to validate API key for bulk contacts routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Only apply this authentication to bulk contacts routes
    if (request.url.startsWith('/api/v1/bulk-contacts')) {
      const authHeader = request.headers['x-api-key'];

      if (!authHeader || typeof authHeader !== 'string') {
        logger.warn('Bulk contacts API called without API key', {
          url: request.url,
          ip: request.ip,
        });
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid x-api-key header',
        });
      }

      if (authHeader !== BULK_CONTACTS_API_KEY) {
        logger.warn('Bulk contacts API called with invalid API key', {
          url: request.url,
          ip: request.ip,
          providedKey: authHeader,
        });
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      logger.info('Bulk contacts API key validated successfully', {
        url: request.url,
        ip: request.ip,
      });
    }
  });
};

export default fastifyPlugin(bulkContactsAuthPlugin);
