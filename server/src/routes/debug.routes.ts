import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { cacheManager, cacheTestConnection, cacheInspectRedis } from '@/libs/cache';
import { logger } from '@/libs/logger';

const basePath = '/debug';

export default async function Debug(fastify: FastifyInstance, _opts: RouteOptions) {
  // Cache test route
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/cache/test`,
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          redis: Type.Object({
            connected: Type.Boolean(),
            setTest: Type.Boolean(),
            getTest: Type.Boolean(),
            error: Type.Optional(Type.String()),
          }),
          timestamp: Type.String(),
        }),
        500: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Test Cache Connection',
      description: 'Test Redis cache connection and basic operations',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const connectionTest = await cacheTestConnection();

        logger.info('Cache test results', connectionTest);

        reply.send({
          success: true,
          redis: connectionTest,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Cache test route error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Cache test failed',
        });
      }
    },
  });

  // Manual cache set/get test
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/cache/manual`,
    schema: {
      body: Type.Object({
        key: Type.String(),
        value: Type.Any(),
        ttl: Type.Optional(Type.Number()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          set: Type.Boolean(),
          get: Type.Boolean(),
          retrievedValue: Type.Any(),
          timestamp: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Manual Cache Test',
      description: 'Manually test cache set and get operations',
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          key: string;
          value: any;
          ttl?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { key, value, ttl } = request.body;

        // Test set
        await cacheManager.set(key, value, { ttl });
        logger.info('Manual cache set', { key, value, ttl });

        // Test get immediately
        const retrievedValue = await cacheManager.get(key);
        logger.info('Manual cache get', { key, retrievedValue });

        reply.send({
          success: true,
          set: true,
          get: retrievedValue !== null,
          retrievedValue,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Manual cache test error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Manual cache test failed',
        });
      }
    },
  });

  // Get cache stats
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/cache/stats`,
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          stats: Type.Any(),
          timestamp: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Get Cache Stats',
      description: 'Get cache statistics and information',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await cacheManager.getStats();

        reply.send({
          success: true,
          stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Cache stats error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Failed to get cache stats',
        });
      }
    },
  });

  // Inspect Redis directly
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/cache/inspect`,
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          inspection: Type.Any(),
          timestamp: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Inspect Redis',
      description: 'Inspect Redis directly to see what keys exist',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const inspection = await cacheInspectRedis();

        reply.send({
          success: true,
          inspection,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Redis inspection error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Failed to inspect Redis',
        });
      }
    },
  });
}
