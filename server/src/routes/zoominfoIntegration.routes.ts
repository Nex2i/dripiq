import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import {
  getZoominfoAdminIntegrationStatus,
  removeZoominfoAdminIntegration,
  saveZoominfoAdminCredentials,
  testZoominfoAdminCredentials,
} from '@/modules/zoominfoIntegrationAdmin.service';

const basePath = '/integrations/zoominfo';

export default async function zoominfoIntegrationRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: HttpMethods.GET,
    url: basePath,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Integrations'],
      summary: 'Get ZoomInfo integration status',
      description:
        'Admin only. Returns whether ZoomInfo OAuth credentials are configured (masked).',
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request as AuthenticatedRequest;
      const body = await getZoominfoAdminIntegrationStatus(tenantId);
      return reply.send(body);
    },
  });

  fastify.route({
    method: HttpMethods.PUT,
    url: basePath,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Integrations'],
      summary: 'Save ZoomInfo OAuth credentials',
      description:
        'Admin only. Validates token and required Data API scopes, then stores encrypted client secret.',
    },
    handler: async (
      request: FastifyRequest<{
        Body: { clientId: string; clientSecret: string };
      }>,
      reply: FastifyReply
    ) => {
      const { tenantId } = request as AuthenticatedRequest;
      const { clientId, clientSecret } =
        request.body ?? ({} as { clientId: string; clientSecret: string });

      if (!clientId?.trim() || !clientSecret?.trim()) {
        return reply.status(400).send({ message: 'clientId and clientSecret are required' });
      }

      const result = await saveZoominfoAdminCredentials({
        tenantId,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });

      return reply.send({
        message: result.message,
        configured: true,
        clientIdMasked: result.clientIdMasked,
      });
    },
  });

  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/test`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Integrations'],
      summary: 'Test ZoomInfo credentials',
      description:
        'Admin only. Validates client credentials and Data API scopes without persisting them.',
    },
    handler: async (
      request: FastifyRequest<{
        Body: { clientId: string; clientSecret: string };
      }>,
      reply: FastifyReply
    ) => {
      const { clientId, clientSecret } =
        request.body ?? ({} as { clientId: string; clientSecret: string });

      if (!clientId?.trim() || !clientSecret?.trim()) {
        return reply.status(400).send({ message: 'clientId and clientSecret are required' });
      }

      await testZoominfoAdminCredentials(clientId.trim(), clientSecret.trim());

      return reply.send({ ok: true, message: 'ZoomInfo connection succeeded' });
    },
  });

  fastify.route({
    method: HttpMethods.DELETE,
    url: basePath,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Integrations'],
      summary: 'Remove ZoomInfo integration',
      description: 'Admin only. Deletes stored credentials and clears cached OAuth tokens.',
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request as AuthenticatedRequest;
      await removeZoominfoAdminIntegration(tenantId);
      return reply.send({ message: 'ZoomInfo integration removed', configured: false });
    },
  });
}
