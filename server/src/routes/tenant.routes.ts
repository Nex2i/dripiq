import { FastifyInstance, RouteOptions } from 'fastify';

const basePath = '/tenants';

export default async function TenantRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  fastify.route({
    method: 'PUT',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id/embed`,
    handler: async (request, reply) => {
      return reply.send({ message: 'Hello World' });
    },
  });
}
