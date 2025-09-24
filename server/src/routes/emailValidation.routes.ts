import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Static } from '@sinclair/typebox';
import { logger } from '@/libs/logger';
import { EmailValidationService } from '@/libs/email-validation';
import {
  emailValidationResponseSchema,
  emailValidationErrorResponseSchema,
  emailValidationQuerySchema,
} from './apiSchema/emailValidation';

// Type definitions
type EmailValidationQuery = Static<typeof emailValidationQuerySchema>;
type EmailValidationResponse = Static<typeof emailValidationResponseSchema>;
type EmailValidationErrorResponse = Static<typeof emailValidationErrorResponseSchema>;

const basePath = '/api/email-validation';

export default async function EmailValidationRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Create email validation service instance
  const emailValidationService = EmailValidationService.createDefault();

  /**
   * GET /api/email-validation
   * Validates an email address via GET query parameter
   */
  fastify.get<{
    Querystring: EmailValidationQuery;
    Reply: EmailValidationResponse | EmailValidationErrorResponse;
  }>(
    `${basePath}`,
    {
      schema: {
        description: 'Validate an email address via query parameter',
        tags: ['Email Validation'],
        querystring: emailValidationQuerySchema,
        response: {
          200: emailValidationResponseSchema,
          400: emailValidationErrorResponseSchema,
          500: emailValidationErrorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: EmailValidationQuery }>, reply: FastifyReply) => {
      try {
        const { email } = request.query;

        if (!email) {
          return reply.code(400).send({
            error: 'Email parameter is required',
            statusCode: 400,
          });
        }

        logger.info('Email validation request received', {
          email,
          method: 'GET',
        });

        // Validate email using the service
        const result = await emailValidationService.validateEmail(email);

        logger.info('Email validation completed', {
          email,
          status: result.status,
          subStatus: result.sub_status,
          mxFound: result.mx_found,
        });

        return reply.code(200).send(result);
      } catch (error) {
        logger.error('Email validation error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        return reply.code(500).send({
          error: 'Internal server error during email validation',
          statusCode: 500,
        });
      }
    }
  );
}
