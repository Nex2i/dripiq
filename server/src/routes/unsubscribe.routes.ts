import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { unsubscribeService } from '@/modules/unsubscribe';
import { tenantRepository } from '@/repositories';
import { logger } from '@/libs/logger';
import {
  UnsubscribeQuerySchema,
  ManualUnsubscribeRequestSchema,
  UnsubscribeStatusQuerySchema,
  UnsubscribeStatsQuerySchema,
  UnsubscribeSuccessResponseSchema,
  UnsubscribeStatusResponseSchema,
  UnsubscribeStatsResponseSchema,
  UnsubscribeErrorResponseSchema,
} from './apiSchema/unsubscribe';

const basePath = '';

export default async function UnsubscribeRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Unsubscribe endpoint - processes unsubscribe and redirects to frontend
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/unsubscribe`,
    schema: {
      tags: ['Unsubscribe'],
      summary: 'Process unsubscribe request',
      description: 'Process email unsubscribe request and redirect to success page.',
      querystring: UnsubscribeQuerySchema,
      response: {
        302: Type.Void(),
        400: UnsubscribeErrorResponseSchema,
        404: UnsubscribeErrorResponseSchema,
        500: UnsubscribeErrorResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          email: string;
          tenant: string;
          campaign?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, tenant, campaign } = request.query;

        // Validate required parameters
        if (!email || !tenant) {
          return reply.status(400).send({
            error: 'Missing required parameters: email and tenant',
          });
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          return reply.status(400).send({ error: 'Invalid email format' });
        }

        // Optional: Validate tenant exists (security measure)
        try {
          const tenantExists = await tenantRepository.findById(tenant);
          if (!tenantExists) {
            logger.warn('Unsubscribe attempt with invalid tenant', {
              tenant,
              email: normalizedEmail,
              ip: request.ip,
            });
            return reply.status(404).send({ error: 'Invalid request' });
          }
        } catch (error) {
          logger.error('Error validating tenant for unsubscribe', {
            tenant,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue with unsubscribe even if tenant validation fails
        }

        // Record the unsubscribe
        await unsubscribeService.unsubscribeByChannel(
          tenant,
          'email',
          normalizedEmail,
          'link_click',
          {
            campaignId: campaign,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          }
        );

        // Redirect to frontend success page
        const frontendUrl =
          process.env.UNSUBSCRIBE_FRONTEND_URL || 'http://localhost:5173/unsubscribe/success';
        const redirectUrl = `${frontendUrl}?email=${encodeURIComponent(normalizedEmail)}`;

        return reply.redirect(redirectUrl);
      } catch (error) {
        logger.error('Unsubscribe request failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          query: request.query,
          ip: request.ip,
        });

        return reply.status(500).send({ error: 'Failed to process unsubscribe request' });
      }
    },
  });

  // Manual unsubscribe API for admin use
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/unsubscribe`,
    preHandler: [fastify.authPrehandler], // Require authentication for manual unsubscribe
    schema: {
      tags: ['Unsubscribe'],
      summary: 'Manual unsubscribe',
      description: 'Manually unsubscribe an email address (admin use).',
      body: ManualUnsubscribeRequestSchema,
      response: {
        200: UnsubscribeSuccessResponseSchema,
        400: UnsubscribeErrorResponseSchema,
        403: UnsubscribeErrorResponseSchema,
        500: UnsubscribeErrorResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          email: string;
          tenantId: string;
          source?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, tenantId, source = 'manual' } = request.body;
        const requestingTenantId = (request as any).tenantId as string;

        // Security check: ensure user can only unsubscribe for their tenant
        if (tenantId !== requestingTenantId) {
          return reply.status(403).send({
            error: 'You can only manage unsubscribes for your own tenant',
          });
        }

        if (!email || !tenantId) {
          return reply.status(400).send({
            error: 'Missing required fields: email and tenantId',
          });
        }

        await unsubscribeService.unsubscribeByChannel(
          tenantId,
          'email',
          email.toLowerCase().trim(),
          source,
          {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          }
        );

        return reply.send({ success: true, message: 'Successfully unsubscribed' });
      } catch (error) {
        logger.error('Manual unsubscribe failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          body: request.body,
        });

        return reply.status(500).send({ error: 'Failed to process unsubscribe' });
      }
    },
  });

  // Check unsubscribe status (for admin use)
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/unsubscribe/status`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Unsubscribe'],
      summary: 'Check unsubscribe status',
      description: 'Check if an email address is unsubscribed.',
      querystring: UnsubscribeStatusQuerySchema,
      response: {
        200: UnsubscribeStatusResponseSchema,
        400: UnsubscribeErrorResponseSchema,
        500: UnsubscribeErrorResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          email: string;
          channel?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, channel = 'email' } = request.query;
        const tenantId = (request as any).tenantId as string;

        if (!email) {
          return reply.status(400).send({
            error: 'Missing required parameter: email',
          });
        }

        const isUnsubscribed = await unsubscribeService.isChannelUnsubscribed(
          tenantId,
          channel,
          email.toLowerCase().trim()
        );

        return reply.send({
          email: email.toLowerCase().trim(),
          channel,
          isUnsubscribed,
        });
      } catch (error) {
        logger.error('Check unsubscribe status failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          query: request.query,
        });

        return reply.status(500).send({ error: 'Failed to check unsubscribe status' });
      }
    },
  });

  // Get unsubscribe statistics for tenant (admin only)
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/unsubscribe/stats`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Unsubscribe'],
      summary: 'Get unsubscribe statistics',
      description: 'Get unsubscribe statistics for the tenant (admin only).',
      querystring: UnsubscribeStatsQuerySchema,
      response: {
        200: UnsubscribeStatsResponseSchema,
        500: UnsubscribeErrorResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          channel?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { channel } = request.query;
        const tenantId = (request as any).tenantId as string;

        const stats = await unsubscribeService.getUnsubscribeStats(tenantId, channel);

        return reply.send(stats);
      } catch (error) {
        logger.error('Get unsubscribe stats failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          query: request.query,
        });

        return reply.status(500).send({ error: 'Failed to get unsubscribe statistics' });
      }
    },
  });
}