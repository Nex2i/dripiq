import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { emailListVerifyClient } from '@/libs/email/emailListVerify.client';

const basePath = '/email-validation';

export default async function EmailValidation(fastify: FastifyInstance, _opts: RouteOptions) {
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/verify`,
    preHandler: [fastify.authPrehandler],
    schema: {
      querystring: Type.Object({
        email: Type.String({ description: 'Email address to verify' }),
      }),
      response: {
        200: Type.Any(),
      },
      tags: ['Email Validation'],
      summary: 'Verify Email Address',
      description: 'Verify an email address using EmailListVerify service',
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          email: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { email } = request.query;

      const result = await emailListVerifyClient.verifyEmailDetailed(email);

      return reply.status(200).send(result);
    },
  });
}
