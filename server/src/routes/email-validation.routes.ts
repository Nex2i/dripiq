import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { abstractApiEmailValidationClient } from '@/libs/abstractapi-email-validation.client';
import { logger } from '@/libs/logger';

const basePath = '/email-validation';

interface EmailValidationQueryParams {
  email: string;
}

export default async function EmailValidation(fastify: FastifyInstance, _opts: RouteOptions) {
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/validate`,
    schema: {
      querystring: Type.Object({
        email: Type.String({
          format: 'email',
          description: 'Email address to validate',
        }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            email: Type.String(),
            autocorrect: Type.String(),
            deliverability: Type.Union([
              Type.Literal('DELIVERABLE'),
              Type.Literal('UNDELIVERABLE'),
              Type.Literal('RISKY'),
              Type.Literal('UNKNOWN'),
            ]),
            quality_score: Type.Number(),
            is_valid_format: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
            is_free_email: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
            is_disposable_email: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
            is_role_email: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
            is_catchall_email: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
            is_mx_found: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
            is_smtp_valid: Type.Object({
              value: Type.Boolean(),
              text: Type.String(),
            }),
          }),
          timestamp: Type.String(),
        }),
        400: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
          code: Type.Optional(Type.String()),
        }),
        500: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
          code: Type.Optional(Type.String()),
        }),
      },
      tags: ['Email Validation'],
      summary: 'Validate Email Address',
      description:
        'Validate an email address using AbstractAPI Email Validation service. Returns deliverability status, quality score, and various email characteristics.',
    },
    handler: async (
      request: FastifyRequest<{ Querystring: EmailValidationQueryParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { email } = request.query;

        if (!email) {
          return reply.status(400).send({
            success: false,
            error: 'Email query parameter is required',
            code: 'MISSING_EMAIL',
          });
        }

        logger.info('Validating email address', { email });

        const validationResult = await abstractApiEmailValidationClient.validateEmail(email);

        logger.info('Email validation completed', {
          email,
          deliverability: validationResult.deliverability,
          quality_score: validationResult.quality_score,
        });

        return reply.status(200).send({
          success: true,
          data: validationResult,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Email validation failed', {
          email: request.query.email,
          error: error.message || String(error),
        });

        // Check for specific error types
        if (error.message?.includes('Invalid AbstractAPI')) {
          return reply.status(500).send({
            success: false,
            error: 'Email validation service configuration error',
            code: 'INVALID_API_KEY',
          });
        }

        if (error.message?.includes('rate limit')) {
          return reply.status(429).send({
            success: false,
            error: 'Rate limit exceeded for email validation service',
            code: 'RATE_LIMIT_EXCEEDED',
          });
        }

        if (error.message?.includes('timeout')) {
          return reply.status(504).send({
            success: false,
            error: 'Email validation service timeout',
            code: 'SERVICE_TIMEOUT',
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to validate email address',
          code: 'VALIDATION_ERROR',
        });
      }
    },
  });
}
