import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';

const basePath = '/ping';

export default async function Ping(fastify: FastifyInstance, _opts: RouteOptions) {
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}`,
    handler: (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({
        message: 'Pong',
      });
    },
    schema: {
      tags: ['Ping'],
      summary: 'Ping',
      description: 'Health check endpoint.',
    },
  });
}
