import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { logger } from '@/libs/logger';
import { thirdPartyAuthStateCache } from '@/cache/ThirdPartyAuthStateCache';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import {
  getGoogleOAuth2Client,
  googleCalendarScopes,
  googleScopes,
} from '@/libs/thirdPartyAuth/GoogleAuth';
import { getMicrosoftOAuth2Client, microsoftScopes } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { newGoogleProviderService } from '@/modules/newGoogleProvider.service';
import { newMicrosoftProviderService } from '@/modules/newMicrosoftProvider.service';
import { calendarConnectionService } from '@/modules/scheduling/calendar/CalendarConnectionService';
import {
  googleAuthUrlResponseSchema,
  googleCallbackResponseSchema,
  microsoftAuthUrlResponseSchema,
  microsoftCallbackResponseSchema,
  errorResponseSchema,
} from './apiSchema/thirdPartyAuth';

const basePath = '/third-party';

export default async function ThirdPartyAuth(fastify: FastifyInstance, _opts: RouteOptions) {
  // Google OAuth authorization endpoint
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/google/authorize`,
    schema: {
      response: {
        200: googleAuthUrlResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Initiate Google OAuth Flow',
      description: 'Generate Google OAuth authorization URL to start the authentication process',
    },
    preHandler: [fastify.authPrehandler],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId, user } = request as AuthenticatedRequest;

        const oauth2Client = getGoogleOAuth2Client();
        const state = await thirdPartyAuthStateCache.createAndSet({
          tenantId,
          userId: user.id,
          isNewMailAccount: true,
          purpose: 'mail',
        });

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: googleScopes,
          state: state,
          prompt: 'consent',
        });

        logger.info('Generated Google OAuth authorization URL', {
          state,
          googleScopes,
        });

        return reply.status(200).send({
          authUrl,
          state,
        });
      } catch (error) {
        logger.error('Error generating Google OAuth URL:', error);
        return reply.status(500).send({
          message: 'Failed to generate authorization URL',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/google/calendar/authorize`,
    schema: {
      response: {
        200: googleAuthUrlResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Initiate Google Calendar OAuth Flow',
      description: 'Generate Google OAuth authorization URL for scheduling calendar access',
    },
    preHandler: [fastify.authPrehandler],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId, user } = request as AuthenticatedRequest;

        const oauth2Client = getGoogleOAuth2Client();
        const state = await thirdPartyAuthStateCache.createAndSet({
          tenantId,
          userId: user.id,
          isNewMailAccount: false,
          purpose: 'calendar',
        });

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: googleCalendarScopes,
          state,
          prompt: 'consent',
        });

        return reply.status(200).send({
          authUrl,
          state,
        });
      } catch (error) {
        logger.error('Error generating Google Calendar OAuth URL:', error);
        return reply.status(500).send({
          message: 'Failed to generate authorization URL',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  // Google OAuth callback endpoint
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/google/callback`,
    schema: {
      response: {
        301: googleCallbackResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Handle Google OAuth Callback',
      description: 'Process the Google OAuth callback and exchange authorization code for tokens',
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          code: string;
          state: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { code, state } = request.query;

        const stateData = await thirdPartyAuthStateCache.state(state);

        if (!stateData) {
          throw new Error('Invalid state');
        }

        const { tenantId, userId, isNewMailAccount, purpose } = stateData;

        if (purpose === 'calendar') {
          await calendarConnectionService.setupGoogleConnection(tenantId, userId, code);
        } else if (isNewMailAccount) {
          await newGoogleProviderService.setupNewAccount(tenantId, userId, code);
        }

        await thirdPartyAuthStateCache.clear(state);

        // redirect to the frontend
        return reply.redirect(
          process.env.FRONTEND_ORIGIN +
            (purpose === 'calendar'
              ? '/profile?google-calendar-auth-success=true'
              : '/profile?google-auth-success=true'),
          301
        );
      } catch (error) {
        logger.error('Error in Google OAuth callback:', error);

        return reply.redirect(
          process.env.FRONTEND_ORIGIN + '/profile?google-auth-success=false',
          301
        );
      }
    },
  });

  // Microsoft OAuth authorization endpoint
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/microsoft/authorize`,
    schema: {
      response: {
        200: microsoftAuthUrlResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Initiate Microsoft OAuth Flow',
      description: 'Generate Microsoft OAuth authorization URL to start the authentication process',
    },
    preHandler: [fastify.authPrehandler],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId, user } = request as AuthenticatedRequest;

        const oauth2Client = getMicrosoftOAuth2Client();
        const stateId = await thirdPartyAuthStateCache.createAndSet({
          tenantId,
          userId: user.id,
          isNewMailAccount: true,
          purpose: 'mail',
        });

        const authUrl = oauth2Client.generateAuthUrl(microsoftScopes, stateId);

        logger.info('Generated Microsoft OAuth authorization URL', {
          state: stateId,
          microsoftScopes,
        });

        return reply.status(200).send({
          authUrl,
          state: stateId,
        });
      } catch (error) {
        logger.error('Error generating Microsoft OAuth URL:', error);
        return reply.status(500).send({
          message: 'Failed to generate authorization URL',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/microsoft/calendar/authorize`,
    schema: {
      response: {
        200: microsoftAuthUrlResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Initiate Microsoft Calendar OAuth Flow',
      description: 'Generate Microsoft OAuth authorization URL for scheduling calendar access',
    },
    preHandler: [fastify.authPrehandler],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId, user } = request as AuthenticatedRequest;

        const oauth2Client = getMicrosoftOAuth2Client();
        const stateId = await thirdPartyAuthStateCache.createAndSet({
          tenantId,
          userId: user.id,
          isNewMailAccount: false,
          purpose: 'calendar',
        });

        const authUrl = oauth2Client.generateAuthUrl(microsoftScopes, stateId);

        return reply.status(200).send({
          authUrl,
          state: stateId,
        });
      } catch (error) {
        logger.error('Error generating Microsoft Calendar OAuth URL:', error);
        return reply.status(500).send({
          message: 'Failed to generate authorization URL',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  // Microsoft OAuth callback endpoint
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/microsoft/callback`,
    schema: {
      response: {
        301: microsoftCallbackResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Handle Microsoft OAuth Callback',
      description:
        'Process the Microsoft OAuth callback and exchange authorization code for tokens',
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          code: string;
          state: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { code, state: stateId } = request.query;

        const stateData = await thirdPartyAuthStateCache.state(stateId);

        if (!stateData) {
          throw new Error('Invalid state');
        }

        const { tenantId, userId, isNewMailAccount, purpose } = stateData;

        if (purpose === 'calendar') {
          await calendarConnectionService.setupMicrosoftConnection(tenantId, userId, code);
        } else if (isNewMailAccount) {
          await newMicrosoftProviderService.setupNewAccount(tenantId, userId, code);
        }

        await thirdPartyAuthStateCache.clear(stateId);

        // redirect to the frontend
        return reply.redirect(
          process.env.FRONTEND_ORIGIN +
            (purpose === 'calendar'
              ? '/profile?microsoft-calendar-auth-success=true'
              : '/profile?microsoft-auth-success=true'),
          301
        );
      } catch (error) {
        logger.error('Error in Microsoft OAuth callback:', error);

        return reply.redirect(
          process.env.FRONTEND_ORIGIN + '/profile?microsoft-auth-success=false',
          301
        );
      }
    },
  });
}
