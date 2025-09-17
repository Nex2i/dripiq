import { Buffer } from 'node:buffer';
import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { GmailReplyService } from '@/modules/email-replies/gmail-reply.service';
import { OutlookReplyService } from '@/modules/email-replies/outlook-reply.service';
import {
  GmailPubSubPayload,
  OutlookWebhookPayload,
  EmailReplyWebhookError,
} from '@/modules/email-replies/email-reply.types';

// Extend FastifyRequest to include raw body
interface WebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
}

const basePath = '/webhooks/email-replies';

// Schema for webhook processing response
const WebhookProcessingResultSchema = Type.Object({
  success: Type.Boolean({ description: 'Whether the webhook was processed successfully' }),
  provider: Type.String({ description: 'Email provider (gmail or outlook)' }),
  threadsProcessed: Type.Number({ description: 'Number of email threads processed' }),
  errors: Type.Array(Type.String(), { description: 'Array of error messages' }),
  processingTimeMs: Type.Number({ description: 'Processing time in milliseconds' }),
});

// Schema for error responses
const WebhookErrorSchema = Type.Object({
  error: Type.String({ description: 'Error code' }),
  message: Type.String({ description: 'Human readable error message' }),
  code: Type.Optional(Type.String({ description: 'Specific error code' })),
  details: Type.Optional(Type.Any({ description: 'Additional error details' })),
});

export default async function EmailReplyWebhookRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions
) {
  // Register custom content type parser to preserve raw body for signature verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    async (request: WebhookRequest, payload: Buffer) => {
      // Store the raw body for signature verification
      request.rawBody = payload;

      try {
        // Parse the JSON for normal usage
        return JSON.parse(payload.toString('utf8'));
      } catch (_error) {
        throw new Error('Invalid JSON payload');
      }
    }
  );

  // Gmail Pub/Sub webhook endpoint
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/gmail`,
    schema: {
      description: 'Gmail Pub/Sub webhook endpoint for receiving email reply notifications',
      tags: ['Webhooks', 'Gmail', 'Email Replies'],
      summary: 'Process Gmail Pub/Sub webhook events',
      body: Type.Object({
        message: Type.Object({
          data: Type.String({ description: 'Base64 encoded message data' }),
          messageId: Type.String({ description: 'Pub/Sub message ID' }),
          message_id: Type.String({ description: 'Alternative message ID field' }),
          publishTime: Type.String({ description: 'Message publish time' }),
          publish_time: Type.String({ description: 'Alternative publish time field' }),
        }),
        subscription: Type.String({ description: 'Pub/Sub subscription name' }),
      }),
      response: {
        ...defaultRouteResponse(),
        200: WebhookProcessingResultSchema,
        400: WebhookErrorSchema,
        401: WebhookErrorSchema,
        500: WebhookErrorSchema,
      },
    },
    // Add request size limit (5MB max)
    bodyLimit: 5 * 1024 * 1024,
    handler: async (request: WebhookRequest, reply: FastifyReply) => {
      const requestId = request.id;
      const startTime = Date.now();

      try {
        const payload = request.body as GmailPubSubPayload;

        logger.info('Received Gmail Pub/Sub webhook', {
          requestId,
          messageId: payload.message.messageId,
          subscription: payload.subscription,
          publishTime: payload.message.publishTime,
          ip: request.ip,
        });

        // Check if Gmail reply webhooks are enabled
        if (process.env.EMAIL_REPLY_WEBHOOK_ENABLED === 'false') {
          logger.warn('Email reply webhook processing is disabled', { requestId });
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'Email reply webhook processing is currently disabled',
          });
        }

        // For Gmail, we need to get a user's refresh token to access their Gmail
        // This is a simplified approach - in production you'd need to determine
        // which user's Gmail account this notification is for
        const refreshToken = await getGmailRefreshToken();
        if (!refreshToken) {
          logger.error('No Gmail refresh token available for processing webhook', { requestId });
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No Gmail account configured for webhook processing',
          });
        }

        // Process the Gmail webhook
        const gmailService = GmailReplyService.fromRefreshToken(refreshToken);
        const result = await gmailService.processGmailWebhook(payload);

        const processingTime = Date.now() - startTime;

        logger.info('Gmail webhook processed successfully', {
          requestId,
          ...result,
        });

        return reply.status(200).send(result);
      } catch (error) {
        const processingTime = Date.now() - startTime;

        if (error instanceof EmailReplyWebhookError) {
          logger.warn('Gmail webhook processing error', {
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

        logger.error('Unexpected error processing Gmail webhook', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          processingTimeMs: processingTime,
        });

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while processing the Gmail webhook',
        });
      }
    },
  });

  // Outlook webhook endpoint
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/outlook`,
    schema: {
      description: 'Outlook webhook endpoint for receiving email reply notifications',
      tags: ['Webhooks', 'Outlook', 'Email Replies'],
      summary: 'Process Outlook webhook events',
      body: Type.Object({
        value: Type.Array(
          Type.Object({
            subscriptionId: Type.String(),
            subscriptionExpirationDateTime: Type.String(),
            tenantId: Type.String(),
            clientState: Type.Optional(Type.String()),
            changeType: Type.String(),
            resource: Type.String(),
            resourceData: Type.Object({
              '@odata.type': Type.String(),
              '@odata.id': Type.String(),
              '@odata.etag': Type.String(),
              id: Type.String(),
            }),
          })
        ),
      }),
      response: {
        ...defaultRouteResponse(),
        200: WebhookProcessingResultSchema,
        400: WebhookErrorSchema,
        401: WebhookErrorSchema,
        500: WebhookErrorSchema,
      },
    },
    // Add request size limit (5MB max)
    bodyLimit: 5 * 1024 * 1024,
    preHandler: async (request: WebhookRequest, reply: FastifyReply) => {
      // Validate Outlook webhook signature if configured
      const rawBody = request.rawBody;
      if (rawBody) {
        const isValid = OutlookReplyService.validateWebhookSignature(
          rawBody.toString('utf8'),
          request.headers
        );

        if (!isValid) {
          logger.warn('Invalid Outlook webhook signature', {
            requestId: request.id,
            ip: request.ip,
          });

          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid webhook signature',
          });
        }
      }
    },
    handler: async (request: WebhookRequest, reply: FastifyReply) => {
      const requestId = request.id;
      const startTime = Date.now();

      try {
        const payload = request.body as OutlookWebhookPayload;

        logger.info('Received Outlook webhook', {
          requestId,
          notificationCount: payload.value.length,
          ip: request.ip,
        });

        // Check if Outlook reply webhooks are enabled
        if (process.env.EMAIL_REPLY_WEBHOOK_ENABLED === 'false') {
          logger.warn('Email reply webhook processing is disabled', { requestId });
          return reply.status(503).send({
            error: 'Service Unavailable',
            message: 'Email reply webhook processing is currently disabled',
          });
        }

        // For Outlook, we need to get a user's refresh token to access their Outlook
        // This is a simplified approach - in production you'd need to determine
        // which user's Outlook account this notification is for
        const refreshToken = await getOutlookRefreshToken();
        if (!refreshToken) {
          logger.error('No Outlook refresh token available for processing webhook', { requestId });
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No Outlook account configured for webhook processing',
          });
        }

        // Process the Outlook webhook
        const outlookService = OutlookReplyService.fromRefreshToken(refreshToken);
        const result = await outlookService.processOutlookWebhook(payload);

        const processingTime = Date.now() - startTime;

        logger.info('Outlook webhook processed successfully', {
          requestId,
          ...result,
        });

        return reply.status(200).send(result);
      } catch (error) {
        const processingTime = Date.now() - startTime;

        if (error instanceof EmailReplyWebhookError) {
          logger.warn('Outlook webhook processing error', {
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

        logger.error('Unexpected error processing Outlook webhook', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          processingTimeMs: processingTime,
        });

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while processing the Outlook webhook',
        });
      }
    },
  });
}

/**
 * Get Gmail refresh token for webhook processing
 * This is a simplified implementation - in production you'd need to:
 * 1. Determine which user's Gmail account the webhook is for
 * 2. Get their specific refresh token
 * 3. Handle multiple Gmail accounts
 */
async function getGmailRefreshToken(): Promise<string | null> {
  try {
    // Get the first Gmail account with a valid refresh token
    const gmailAccount = await mailAccountRepository.findFirstByProvider('google');
    if (!gmailAccount) {
      logger.warn('No Gmail accounts found in database');
      return null;
    }

    const refreshToken = await oauthTokenRepository.getRefreshTokenByMailAccountId(gmailAccount.id);
    return refreshToken;
  } catch (error) {
    logger.error('Failed to get Gmail refresh token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get Outlook refresh token for webhook processing
 * This is a simplified implementation - in production you'd need to:
 * 1. Determine which user's Outlook account the webhook is for
 * 2. Get their specific refresh token
 * 3. Handle multiple Outlook accounts
 */
async function getOutlookRefreshToken(): Promise<string | null> {
  try {
    // Get the first Outlook account with a valid refresh token
    const outlookAccount = await mailAccountRepository.findFirstByProvider('microsoft');
    if (!outlookAccount) {
      logger.warn('No Outlook accounts found in database');
      return null;
    }

    const refreshToken = await oauthTokenRepository.getRefreshTokenByMailAccountId(
      outlookAccount.id
    );
    return refreshToken;
  } catch (error) {
    logger.error('Failed to get Outlook refresh token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
