import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { MessagePublisherService, PublishMessagePayload } from '@/modules/messages/publisher.service';

const messagesRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    '/messages/publish',
    {
      schema: {
        body: Type.Object({
          tenantId: Type.String(),
          userId: Type.String(),
          content: Type.String(),
          metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
        }),
      },
    },
    async (request, reply) => {
      const payload = request.body as PublishMessagePayload;
      const job = await MessagePublisherService.publish(payload);
      return reply.code(202).send({ jobId: job.id });
    }
  );
};

export default messagesRoutes;