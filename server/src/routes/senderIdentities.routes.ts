import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { SenderIdentityService } from '@/modules/email/senderIdentity.service';

const basePath = '/sender-identities';

const SenderIdentityBodySchema = Type.Object({
  fromEmail: Type.String({ format: 'email' }),
  fromName: Type.String(),
  domain: Type.Optional(Type.String()),
  isDefault: Type.Optional(Type.Boolean()),
});

const SenderIdentityIdParams = Type.Object({
  id: Type.String(),
});

const SenderValidationStatus = Type.Union([
  Type.Literal('pending'),
  Type.Literal('verified'),
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

export default async function SenderIdentitiesRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions
) {
  // Create
  fastify.route({
    method: 'POST',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Create sender identity and trigger verification email',
      body: SenderIdentityBodySchema,
      response: {
        201: SenderIdentitySchema,
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: typeof SenderIdentityBodySchema.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const { fromEmail, fromName, domain, isDefault } = request.body;
      const created = await SenderIdentityService.createSenderIdentity({
        tenantId,
        userId: user.id,
        fromEmail,
        fromName,
        domain,
        isDefault,
      });
      return reply.status(201).send(created);
    },
  });

  // List
  fastify.route({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'List sender identities for tenant',
      response: {
        200: Type.Array(SenderIdentitySchema),
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request as AuthenticatedRequest;
      const list = await SenderIdentityService.listSenderIdentities(tenantId);
      return reply.send(list);
    },
  });

  // Get One
  fastify.route({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Get sender identity by id',
      params: SenderIdentityIdParams,
      response: {
        200: SenderIdentitySchema,
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: typeof SenderIdentityIdParams.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as AuthenticatedRequest;
      const { id } = request.params;
      const item = await SenderIdentityService.getSenderIdentity(tenantId, id);
      if (!item) return reply.status(404).send({ message: 'Not found' });
      return reply.send(item);
    },
  });

  // Resend verification
  fastify.route({
    method: 'POST',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id/resend`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Resend verification email',
      params: SenderIdentityIdParams,
      response: {
        200: MessageSchema,
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: typeof SenderIdentityIdParams.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as AuthenticatedRequest;
      const { id } = request.params;
      const result = await SenderIdentityService.resendVerification(tenantId, id);
      return reply.send(result);
    },
  });

  // Check status
  fastify.route({
    method: 'POST',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id/check`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Check verification status and update',
      params: SenderIdentityIdParams,
      response: {
        200: SenderIdentitySchema,
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: typeof SenderIdentityIdParams.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as AuthenticatedRequest;
      const { id } = request.params;
      const updated = await SenderIdentityService.checkStatus(tenantId, id);
      return reply.send(updated);
    },
  });

  // Set default
  fastify.route({
    method: 'PATCH',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id/default`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Set this identity as default for tenant',
      params: SenderIdentityIdParams,
      response: {
        200: SenderIdentitySchema,
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: typeof SenderIdentityIdParams.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as AuthenticatedRequest;
      const { id } = request.params;
      const updated = await SenderIdentityService.setDefault(tenantId, id);
      return reply.send(updated);
    },
  });

  // Delete
  fastify.route({
    method: 'DELETE',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      tags: ['Sender Identities'],
      summary: 'Delete sender identity',
      params: SenderIdentityIdParams,
      response: {
        200: MessageSchema,
        400: MessageSchema,
        401: MessageSchema,
        403: MessageSchema,
        404: MessageSchema,
        500: MessageSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: typeof SenderIdentityIdParams.static }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as AuthenticatedRequest;
      const { id } = request.params;
      const result = await SenderIdentityService.remove(tenantId, id);
      return reply.send(result);
    },
  });
}