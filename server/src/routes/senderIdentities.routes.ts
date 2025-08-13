import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { SenderIdentityService } from '@/modules/email/senderIdentity.service';
import { defaultRouteResponse } from '@/types/response';
import { HttpMethods } from '@/utils/HttpMethods';
import { emailSenderIdentityRepository } from '@/repositories';

const basePath = '/sender-identities';

const SenderIdentityBodySchema = Type.Object({
  fromEmail: Type.String({ format: 'email' }),
  fromName: Type.String(),
  address: Type.String(),
  city: Type.String(),
  country: Type.Optional(Type.String()),
});

const SenderValidationStatus = Type.Union([
  Type.Literal('pending'),
  Type.Literal('verified'),
  Type.Literal('validated'),
  Type.Literal('failed'),
]);

const SenderIdentitySchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  userId: Type.String(),
  fromEmail: Type.String(),
  fromName: Type.String(),
  domain: Type.String(),
  sendgridSenderId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  validationStatus: SenderValidationStatus,
  lastValidatedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  dedicatedIpPool: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  isDefault: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const MessageSchema = Type.Object({ message: Type.String() });
const ValidationErrorSchema = Type.Object({
  message: Type.String(),
  errors: Type.Array(Type.Object({ field: Type.String(), message: Type.String() })),
});

export default async function SenderIdentitiesRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions
) {
  // Self-scoped: Get my sender identity
  fastify.route({
    method: HttpMethods.GET,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/me`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Get my sender identity',
      response: {
        ...defaultRouteResponse(),
        200: SenderIdentitySchema,
        204: Type.Null(),
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const existing = await emailSenderIdentityRepository.findByUserIdForTenant(user.id, tenantId);
      if (!existing) return reply.status(204).send();
      return reply.status(200).send(existing);
    },
  });

  // Self-scoped: Create or get mine
  fastify.route({
    method: HttpMethods.POST,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/me`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Create my sender identity',
      body: SenderIdentityBodySchema,
      response: {
        ...defaultRouteResponse(),
        201: SenderIdentitySchema,
        422: ValidationErrorSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: typeof SenderIdentityBodySchema.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const { fromEmail, fromName, address, city, country } = request.body;
      try {
        const created = await SenderIdentityService.getOrCreateForUser(
          tenantId,
          user.id,
          fromName,
          fromEmail,
          address,
          city,
          country || 'USA'
        );
        return reply.status(201).send(created);
      } catch (e: any) {
        if (e?.statusCode === 422) {
          return reply.status(422).send({ message: 'Validation error', errors: e.details || [] });
        }
        throw e;
      }
    },
  });

  // Self-scoped: Resend
  fastify.route({
    method: HttpMethods.POST,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/me/resend`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Resend verification email for my sender identity',
      response: {
        ...defaultRouteResponse(),
        200: MessageSchema,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const result = await SenderIdentityService.resendForUser(tenantId, user.id);
      return reply.status(200).send(result);
    },
  });

  // Self-scoped: Retry (create or resend)
  fastify.route({
    method: HttpMethods.POST,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/me/retry`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Retry creating or resending my sender identity verification',
      body: Type.Partial(SenderIdentityBodySchema),
      response: {
        ...defaultRouteResponse(),
        200: SenderIdentitySchema,
        201: SenderIdentitySchema,
        422: ValidationErrorSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: Partial<typeof SenderIdentityBodySchema.static> }>,
      reply: FastifyReply
    ) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const fromName = request.body.fromName ?? user?.name ?? '';
      const fromEmail = request.body.fromEmail ?? (user as any)?.email;
      try {
        const result = await SenderIdentityService.retryForUser(
          tenantId,
          user.id,
          fromName,
          fromEmail,
          request.body.address,
          request.body.city,
          request.body.country || 'USA'
        );
        return reply.status(200).send(result);
      } catch (e: any) {
        if (e?.statusCode === 422) {
          return reply.status(422).send({ message: 'Validation error', errors: e.details || [] });
        }
        throw e;
      }
    },
  });

  // Self-scoped: Check
  fastify.route({
    method: HttpMethods.POST,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/me/check`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Check my sender identity verification status',
      response: {
        ...defaultRouteResponse(),
        200: SenderIdentitySchema,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const updated = await SenderIdentityService.checkForUser(tenantId, user.id);
      return reply.status(200).send(updated);
    },
  });

  // Self-scoped: Verify with pasted URL/token
  fastify.route({
    method: HttpMethods.POST,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/me/verify`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Verify my sender identity using a pasted URL',
      body: Type.Object({ sendgridValidationUrl: Type.String() }),
      response: {
        ...defaultRouteResponse(),
        200: SenderIdentitySchema,
        422: ValidationErrorSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: { sendgridValidationUrl: string } }>,
      reply: FastifyReply
    ) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      try {
        const updated = await SenderIdentityService.verifyForUser(
          tenantId,
          user.id,
          request.body.sendgridValidationUrl
        );
        return reply.status(200).send(updated);
      } catch (e: any) {
        if (e?.statusCode === 422) {
          return reply.status(422).send({ message: 'Validation error', errors: e.details || [] });
        }
        throw e;
      }
    },
  });
}