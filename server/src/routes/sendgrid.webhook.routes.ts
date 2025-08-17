import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import { sendGridWebhookService } from '@/modules/webhooks/sendgrid.webhook.service';
import { SendGridWebhookError } from '@/modules/webhooks/sendgrid.webhook.types';

const basePath = '/webhooks/sendgrid';

// Schema for webhook processing response
const WebhookProcessingResultSchema = Type.Object({
  success: Type.Boolean({ description: 'Whether the webhook was processed successfully' }),
  webhookDeliveryId: Type.String({ description: 'ID of the stored webhook delivery record' }),
  totalEvents: Type.Number({ description: 'Total number of events in the webhook' }),
  successfulEvents: Type.Number({ description: 'Number of successfully processed events' }),
  failedEvents: Type.Number({ description: 'Number of failed events' }),
  skippedEvents: Type.Number({ description: 'Number of skipped events (duplicates, etc.)' }),
  errors: Type.Array(Type.String(), { description: 'Array of error messages' }),
});

// Schema for error responses
const WebhookErrorSchema = Type.Object({
  error: Type.String({ description: 'Error code' }),
  message: Type.String({ description: 'Human readable error message' }),
  code: Type.Optional(Type.String({ description: 'Specific error code' })),
  details: Type.Optional(Type.Any({ description: 'Additional error details' })),
});

export default async function SendGridWebhookRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Register rate limiting for webhook endpoint
  await fastify.register(fastifyRateLimit, {
    max: 1000, // Max 1000 requests per window
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => {
      // Use IP address for rate limiting
      return request.ip;
    },
    errorResponseBuilder: () => ({
      error: 'Rate Limit Exceeded',
      message: 'Too many webhook requests. Please try again later.',
      retryAfter: 60,
    }),
    onExceeding: (request: FastifyRequest) => {
      logger.warn('SendGrid webhook rate limit exceeded', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    },
  });

  // Health check endpoint for webhook
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/health`,
    schema: {
      description: 'Health check for SendGrid webhook endpoint',
      tags: ['Webhooks', 'Health'],
      summary: 'Check webhook endpoint health',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.String({ format: 'date-time' }),
          service: Type.String(),
        }),
      },
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'sendgrid-webhook',
      });
    },
  });

  // Main SendGrid webhook endpoint
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/events`,
    schema: {
      description: 'SendGrid Event Webhook endpoint for receiving email events',
      tags: ['Webhooks', 'SendGrid'],
      summary: 'Process SendGrid webhook events',
      headers: Type.Object({
        'x-twilio-email-event-webhook-signature': Type.String({
          description: 'SendGrid webhook signature for verification',
        }),
        'x-twilio-email-event-webhook-timestamp': Type.String({
          description: 'SendGrid webhook timestamp for verification',
        }),
        'content-type': Type.String({ default: 'application/json' }),
      }),
      body: Type.Array(Type.Any(), {
        description: 'Array of SendGrid events',
      }),
      response: {
        ...defaultRouteResponse(),
        200: WebhookProcessingResultSchema,
        400: WebhookErrorSchema,
        401: WebhookErrorSchema,
        413: WebhookErrorSchema,
        422: WebhookErrorSchema,
        429: Type.Object({
          error: Type.String(),
          message: Type.String(),
          retryAfter: Type.Number(),
        }),
        500: WebhookErrorSchema,
      },
    },
    // Add request size limit (5MB max)
    bodyLimit: 5 * 1024 * 1024,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id;
      const startTime = Date.now();

      try {
        // Log incoming webhook request
        logger.info('Received SendGrid webhook', {
          requestId,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          contentLength: request.headers['content-length'],
          signature: request.headers['x-twilio-email-event-webhook-signature']
            ? 'present'
            : 'missing',
          timestamp: request.headers['x-twilio-email-event-webhook-timestamp']
            ? 'present'
            : 'missing',
        });

        // Check if SendGrid webhook processing is enabled
        if (process.env.SENDGRID_WEBHOOK_ENABLED === 'false') {
          logger.warn('SendGrid webhook processing is disabled', { requestId });
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'SendGrid webhook processing is currently disabled',
          });
        }

        // Get raw body for signature verification
        const rawBody = request.body as string;
        if (!rawBody) {
          logger.error('Missing raw body for signature verification', { requestId });
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Request body is required for signature verification',
          });
        }

        // Validate content type
        const contentType = request.headers['content-type'];
        if (!contentType?.includes('application/json')) {
          logger.warn('Invalid content type for webhook', {
            requestId,
            contentType,
          });
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Content-Type must be application/json',
          });
        }

        // Process the webhook
        const result = await sendGridWebhookService.instance.processWebhook(
          request.headers,
          rawBody
        );

        const processingTime = Date.now() - startTime;

        // Log successful processing
        logger.info('SendGrid webhook processed successfully', {
          requestId,
          processingTimeMs: processingTime,
          ...result,
        });

        return reply.status(200).send(result);
      } catch (error) {
        const processingTime = Date.now() - startTime;

        if (error instanceof SendGridWebhookError) {
          logger.warn('SendGrid webhook processing error', {
            requestId,
            error: error.message,
            code: error.code,
            statusCode: error.statusCode,
            processingTimeMs: processingTime,
          });

          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
            code: error.code,
            ...(error.details && { details: error.details }),
          });
        }

        // Log unexpected errors
        logger.error('Unexpected error processing SendGrid webhook', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          processingTimeMs: processingTime,
        });

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while processing the webhook',
        });
      }
    },
    // Add custom preHandler for additional validation
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
      // Check for required headers early
      const signature = request.headers['x-twilio-email-event-webhook-signature'];
      const timestamp = request.headers['x-twilio-email-event-webhook-timestamp'];

      if (!signature || !timestamp) {
        logger.warn('Missing required SendGrid webhook headers', {
          requestId: request.id,
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
          ip: request.ip,
        });

        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing required SendGrid webhook signature or timestamp headers',
        });
      }

      // Basic IP validation (optional - can be configured)
      const allowedIPs = process.env.SENDGRID_WEBHOOK_ALLOWED_IPS?.split(',').map((ip) =>
        ip.trim()
      );
      if (allowedIPs && allowedIPs.length > 0) {
        const clientIP = request.ip;
        if (!allowedIPs.includes(clientIP)) {
          logger.warn('SendGrid webhook request from unauthorized IP', {
            requestId: request.id,
            clientIP,
            allowedIPs,
          });

          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Webhook requests from this IP address are not allowed',
          });
        }
      }
    },
  });

  // Debug endpoint to get recent webhook deliveries (for development/debugging)
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/deliveries/recent`,
    preHandler: [fastify.authPrehandler], // Require authentication for debug endpoints
    schema: {
      description: 'Get recent SendGrid webhook deliveries for debugging',
      tags: ['Webhooks', 'Debug'],
      summary: 'List recent webhook deliveries',
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
      }),
      response: {
        ...defaultRouteResponse(),
        200: Type.Array(
          Type.Object({
            id: Type.String(),
            eventType: Type.String(),
            status: Type.String(),
            receivedAt: Type.String({ format: 'date-time' }),
            totalEvents: Type.Number(),
            provider: Type.String(),
          })
        ),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: { limit?: number };
      }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as any; // From auth prehandler
      const limit = request.query.limit || 10;

      try {
        const { webhookDeliveryRepository } = await import('@/repositories');
        const deliveries = await webhookDeliveryRepository.listByProviderForTenant(
          tenantId,
          'sendgrid',
          limit
        );

        const formattedDeliveries = deliveries.map((delivery) => ({
          id: delivery.id,
          eventType: delivery.eventType,
          status: delivery.status,
          receivedAt: delivery.receivedAt.toISOString(),
          totalEvents: Array.isArray(delivery.payload) ? delivery.payload.length : 1,
          provider: delivery.provider,
        }));

        return reply.status(200).send(formattedDeliveries);
      } catch (error) {
        logger.error('Error fetching recent webhook deliveries', {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
        });

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch webhook deliveries',
        });
      }
    },
  });

  // Webhook configuration test endpoint
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/config/test`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Test SendGrid webhook configuration',
      tags: ['Webhooks', 'Configuration'],
      summary: 'Test webhook configuration and connectivity',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          configured: Type.Boolean(),
          secretConfigured: Type.Boolean(),
          enabled: Type.Boolean(),
          rateLimitConfigured: Type.Boolean(),
          timestamp: Type.String({ format: 'date-time' }),
        }),
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const config = {
        configured: !!process.env.SENDGRID_WEBHOOK_SECRET,
        secretConfigured:
          !!process.env.SENDGRID_WEBHOOK_SECRET && process.env.SENDGRID_WEBHOOK_SECRET.length >= 16,
        enabled: process.env.SENDGRID_WEBHOOK_ENABLED !== 'false',
        rateLimitConfigured: true, // Always configured in this implementation
        timestamp: new Date().toISOString(),
      };

      logger.info('SendGrid webhook configuration checked', {
        ...config,
        requestId: request.id,
      });

      return reply.status(200).send(config);
    },
  });
}
