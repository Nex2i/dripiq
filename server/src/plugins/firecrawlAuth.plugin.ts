import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { logger } from '@/libs/logger';
import { verifySignedJwt } from '../libs/jwt';

const firecrawlAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // Add a preHandler hook to validate JWT tokens for Firecrawl webhook routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Only apply this authentication to Firecrawl webhook routes
    if (request.url.startsWith('/api/firecrawl/webhook')) {
      const authHeader = request.headers['x-api-key'];

      if (!authHeader || typeof authHeader !== 'string') {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid x-api-key header',
        });
      }

      try {
        // Verify the JWT token using the Firecrawl API key as the secret
        const secretKey = process.env.FIRECRAWL_API_KEY;
        if (!secretKey) {
          logger.error('FIRECRAWL_API_KEY environment variable is not set');
          return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Server configuration error',
          });
        }

        verifySignedJwt(authHeader, secretKey);
      } catch (error) {
        logger.error('Firecrawl JWT validation failed:', error);
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired JWT token',
        });
      }
    }
  });
};

export default fastifyPlugin(firecrawlAuthPlugin);
