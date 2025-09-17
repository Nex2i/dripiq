import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import { gmail_v1, google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { getMicrosoftOAuth2Client } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { db } from '@/db';
import { mailAccounts, oauthTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const basePath = '/webhooks/email-reply';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper functions for setting up push notifications
export async function setupGmailWatch(userId: string): Promise<void> {
  try {
    // Get user's Gmail account
    const mailAccount = await db
      .select({ id: mailAccounts.id })
      .from(mailAccounts)
      .where(and(
        eq(mailAccounts.userId, userId),
        eq(mailAccounts.provider, 'google')
      ))
      .limit(1);

    if (mailAccount.length === 0) {
      console.log('No Gmail account found for user:', userId);
      return;
    }

    // Get refresh token
    const tokenRecord = await db
      .select({ refreshToken: oauthTokens.refreshToken })
      .from(oauthTokens)
      .where(and(
        eq(oauthTokens.mailAccountId, mailAccount[0].id),
        eq(oauthTokens.status, 'active')
      ))
      .limit(1);

    if (tokenRecord.length === 0) {
      console.log('No active Gmail token found for user:', userId);
      return;
    }

    // Setup Gmail client
    const googleAuth = new google.auth.OAuth2({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    googleAuth.setCredentials({ refresh_token: tokenRecord[0].refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: googleAuth });

    // Setup watch request
    const topicName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`;
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterAction: 'include',
      },
    });

    console.log('Gmail push notifications setup for outbound email:', {
      userId,
      expiration: watchResponse.data.expiration,
      webhookUrl: `${API_URL}/api${basePath}/gmail/notifications`,
    });

    logger.info('Gmail push notifications setup for email send', {
      userId,
      mailAccountId: mailAccount[0].id,
      expiration: watchResponse.data.expiration,
    });
  } catch (error) {
    console.error('Failed to setup Gmail watch for user:', userId, error);
    logger.error('Failed to setup Gmail watch', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
  }
}

export async function setupOutlookSubscription(userId: string): Promise<void> {
  try {
    // Get user's Outlook account
    const mailAccount = await db
      .select({ id: mailAccounts.id })
      .from(mailAccounts)
      .where(and(
        eq(mailAccounts.userId, userId),
        eq(mailAccounts.provider, 'microsoft')
      ))
      .limit(1);

    if (mailAccount.length === 0) {
      console.log('No Outlook account found for user:', userId);
      return;
    }

    // Get refresh token
    const tokenRecord = await db
      .select({ refreshToken: oauthTokens.refreshToken })
      .from(oauthTokens)
      .where(and(
        eq(oauthTokens.mailAccountId, mailAccount[0].id),
        eq(oauthTokens.status, 'active')
      ))
      .limit(1);

    if (tokenRecord.length === 0) {
      console.log('No active Outlook token found for user:', userId);
      return;
    }

    // Setup Graph client
    const graphClient = Client.init({
      authProvider: async (done) => {
        try {
          const oauth2Client = getMicrosoftOAuth2Client();
          const tokenResponse = await oauth2Client.refreshToken(tokenRecord[0].refreshToken);
          done(null, tokenResponse.access_token);
        } catch (error) {
          done(error, null);
        }
      },
    });

    // Calculate expiration time (maximum 4230 minutes for mailbox resources)
    const expirationDateTime = new Date(Date.now() + (4230 * 60 * 1000));

    // Create the subscription
    const subscription = await graphClient.api('/subscriptions').post({
      changeType: 'created',
      notificationUrl: `${API_URL}/api${basePath}/outlook/notifications`,
      resource: '/me/mailFolders/inbox/messages',
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: `${mailAccount[0].id}-${Date.now()}`,
    });

    console.log('Outlook change notifications setup for outbound email:', {
      userId,
      subscriptionId: subscription.id,
      expiration: expirationDateTime,
      webhookUrl: `${API_URL}/api${basePath}/outlook/notifications`,
    });

    logger.info('Outlook change notifications setup for email send', {
      userId,
      mailAccountId: mailAccount[0].id,
      subscriptionId: subscription.id,
      expiration: expirationDateTime,
    });
  } catch (error) {
    console.error('Failed to setup Outlook subscription for user:', userId, error);
    logger.error('Failed to setup Outlook subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
  }
}

export default async function EmailReplyWebhookRoutes(fastify: FastifyInstance, _opts: RouteOptions) {

  /**
   * Gmail Push Notification Webhook
   * Receives notifications from Google Cloud Pub/Sub when new emails arrive
   */
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/gmail/notifications`,
    schema: {
      description: 'Gmail push notification webhook endpoint',
      tags: ['Webhooks', 'Gmail'],
      summary: 'Receive Gmail push notifications from Google Cloud Pub/Sub',
      body: Type.Object({
        message: Type.Object({
          data: Type.String({ description: 'Base64 encoded notification data' }),
          messageId: Type.String({ description: 'Pub/Sub message ID' }),
          publishTime: Type.String({ description: 'Message publish timestamp' }),
        }),
        subscription: Type.String({ description: 'Pub/Sub subscription name' }),
      }),
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          timestamp: Type.String({ format: 'date-time' }),
        }),
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        console.log('=== Gmail Webhook Received ===');
        console.log('Request ID:', request.id);
        console.log('Headers:', JSON.stringify(request.headers, null, 2));
        console.log('Body:', JSON.stringify(request.body, null, 2));

        const body = request.body as any;

        // Decode Pub/Sub message if present
        if (body.message?.data) {
          try {
            const decodedData = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf-8'));
            console.log('Decoded Pub/Sub Data:', JSON.stringify(decodedData, null, 2));
          } catch (decodeError) {
            console.log('Failed to decode Pub/Sub message data:', decodeError);
            logger.warn('Failed to decode Gmail Pub/Sub message', {
              error: decodeError,
              messageId: body.message?.messageId,
            });
          }
        }

        console.log('=== End Gmail Webhook ===\n');

        logger.info('Gmail webhook notification received', {
          requestId: request.id,
          messageId: body.message?.messageId,
          subscription: body.subscription,
        });

        return reply.status(200).send({
          success: true,
          message: 'Gmail notification received and logged',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Gmail webhook error:', error);
        logger.error('Gmail webhook processing failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: request.id,
        });
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  /**
   * Outlook/Microsoft Graph Change Notification Webhook
   * Receives change notifications from Microsoft Graph when new emails arrive
   */
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/outlook/notifications`,
    schema: {
      description: 'Outlook/Microsoft Graph change notification webhook endpoint',
      tags: ['Webhooks', 'Outlook'],
      summary: 'Receive Outlook change notifications from Microsoft Graph',
      querystring: Type.Object({
        validationToken: Type.Optional(Type.String({ description: 'Microsoft Graph validation token' })),
      }),
      body: Type.Optional(
        Type.Object({
          value: Type.Array(
            Type.Object({
              subscriptionId: Type.String(),
              clientState: Type.Optional(Type.String()),
              changeType: Type.String(),
              resource: Type.String(),
              resourceData: Type.Optional(Type.Any()),
              subscriptionExpirationDateTime: Type.String(),
              tenantId: Type.String(),
            })
          ),
        })
      ),
      response: {
        ...defaultRouteResponse(),
        200: Type.Union([
          Type.String(), // For validation token response
          Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
            processedCount: Type.Number(),
            timestamp: Type.String({ format: 'date-time' }),
          }),
        ]),
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        console.log('=== Outlook Webhook Received ===');
        console.log('Request ID:', request.id);
        console.log('Headers:', JSON.stringify(request.headers, null, 2));
        console.log('Query:', JSON.stringify(request.query, null, 2));
        console.log('Body:', JSON.stringify(request.body, null, 2));

        const query = request.query as any;
        const body = request.body as any;

        // Handle Microsoft Graph validation request
        if (query.validationToken) {
          console.log('Responding to Microsoft Graph validation with token:', query.validationToken);
          console.log('=== End Outlook Validation ===\n');

          logger.info('Outlook webhook validation request', {
            requestId: request.id,
            validationToken: query.validationToken,
          });

          return reply.status(200).send(query.validationToken);
        }

        // Log change notifications
        let processedCount = 0;
        if (body?.value && Array.isArray(body.value)) {
          processedCount = body.value.length;
          console.log(`Processing ${processedCount} notification(s):`);
          
          body.value.forEach((notification: any, index: number) => {
            console.log(`Notification ${index + 1}:`, JSON.stringify(notification, null, 2));
          });
        }

        console.log('=== End Outlook Webhook ===\n');

        logger.info('Outlook webhook notifications received', {
          requestId: request.id,
          notificationCount: processedCount,
        });

        return reply.status(200).send({
          success: true,
          message: 'Outlook notifications received and logged',
          processedCount,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Outlook webhook error:', error);
        logger.error('Outlook webhook processing failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: request.id,
        });
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  /**
   * Health check endpoint for email reply webhooks
   */
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/health`,
    schema: {
      description: 'Health check for email reply webhook endpoints',
      tags: ['Webhooks', 'Health'],
      summary: 'Check email reply webhook endpoints health',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.String({ format: 'date-time' }),
          service: Type.String(),
          endpoints: Type.Object({
            gmail: Type.String(),
            outlook: Type.String(),
          }),
        }),
      },
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'email-reply-webhooks',
        endpoints: {
          gmail: `${basePath}/gmail/notifications`,
          outlook: `${basePath}/outlook/notifications`,
        },
      });
    },
  });
}