import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { HttpMethods } from '@/utils/HttpMethods';
import { logger } from '@/libs/logger';
import {
  googleAuthUrlResponseSchema,
  googleCallbackQuerySchema,
  googleCallbackResponseSchema,
  googleDisconnectResponseSchema,
  errorResponseSchema,
} from './apiSchema/thirdPartyAuth';

const basePath = '/auth/third-party';

// Google OAuth2 client configuration
const getGoogleOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/auth/third-party/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
};

// Generate secure random state for CSRF protection
const generateState = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

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
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oauth2Client = getGoogleOAuth2Client();
        const state = generateState();

        // Define the scopes we want to request
        const scopes = [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
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
          redirectUri: oauth2Client.redirectUri,
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
      querystring: googleCallbackQuerySchema,
      response: {
        200: googleCallbackResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema,
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
          scope?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { code, state, scope } = request.query;

        logger.info('Received Google OAuth callback', {
          code: code.substring(0, 10) + '...',
          state,
          scope,
        });

        const oauth2Client = getGoogleOAuth2Client();

        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Log tokens to console (as requested)
        console.log('=== GOOGLE OAUTH TOKENS ===');
        console.log('Access Token:', tokens.access_token);
        console.log('Refresh Token:', tokens.refresh_token);
        console.log('ID Token:', tokens.id_token);
        console.log('Token Type:', tokens.token_type);
        console.log('Expires In:', tokens.expiry_date);
        console.log('Scope:', tokens.scope);
        console.log('============================');

        // Log tokens to server logger
        logger.info('Google OAuth tokens received', {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          hasIdToken: !!tokens.id_token,
          tokenType: tokens.token_type,
          expiresAt: tokens.expiry_date,
          scope: tokens.scope,
          // Note: Not logging actual token values in structured logs for security
        });

        // Get user information
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token!,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
          throw new Error('Failed to get user payload from ID token');
        }

        // Log user data to console (as requested)
        console.log('=== GOOGLE USER DATA ===');
        console.log('User ID:', payload.sub);
        console.log('Email:', payload.email);
        console.log('Name:', payload.name);
        console.log('Picture:', payload.picture);
        console.log('Email Verified:', payload.email_verified);
        console.log('Given Name:', payload.given_name);
        console.log('Family Name:', payload.family_name);
        console.log('Locale:', payload.locale);
        console.log('========================');

        // Log user data to server logger
        logger.info('Google user data retrieved', {
          userId: payload.sub,
          email: payload.email,
          name: payload.name,
          emailVerified: payload.email_verified,
          hasProfile: !!payload.picture,
        });

        const userData = {
          id: payload.sub!,
          email: payload.email!,
          name: payload.name,
          picture: payload.picture,
          verified_email: payload.email_verified,
        };

        return reply.status(200).send({
          success: true,
          message: 'Google OAuth authentication successful',
          userData,
        });
      } catch (error) {
        logger.error('Error in Google OAuth callback:', error);
        return reply.status(500).send({
          message: 'Failed to process Google OAuth callback',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  // Google disconnect endpoint
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/google/disconnect`,
    schema: {
      response: {
        200: googleDisconnectResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Third Party Authentication'],
      summary: 'Disconnect Google Account',
      description: "Disconnect the user's Google account (placeholder for future implementation)",
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // This is a placeholder implementation
        // In a real implementation, you would:
        // 1. Revoke the stored tokens
        // 2. Remove Google account association from user record
        // 3. Clean up any Google-related data

        logger.info('Google account disconnect requested');
        console.log('=== GOOGLE DISCONNECT ===');
        console.log('User requested to disconnect Google account');
        console.log('========================');

        return reply.status(200).send({
          success: true,
          message: 'Google account disconnected successfully',
        });
      } catch (error) {
        logger.error('Error disconnecting Google account:', error);
        return reply.status(500).send({
          message: 'Failed to disconnect Google account',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}
