import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { logger } from '@/libs/logger';
import { thirdPartyAuthStateCache } from '@/cache/ThirdPartyAuthStateCache';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { getGoogleOAuth2Client } from '@/libs/thirdPartyAuth/GoogleAuth';
import { newGoogleProviderService } from '@/modules/newGoogleProvider.service';
import {
  googleAuthUrlResponseSchema,
  googleCallbackResponseSchema,
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
        });

        // Define the scopes we want to request
        const scopes = [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/gmail.send',
          'openid',
        ];

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          state: state,
          prompt: 'consent',
        });

        logger.info('Generated Google OAuth authorization URL', {
          state,
          scopes,
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

        const { tenantId, userId, isNewMailAccount } = stateData;

        if (isNewMailAccount) {
          await newGoogleProviderService.setupNewAccount(tenantId, userId, code);
        }

        await thirdPartyAuthStateCache.clear(state);

        // redirect to the frontend
        return reply.redirect(
          process.env.FRONTEND_ORIGIN + '/profile?google-auth-success=true',
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
}
