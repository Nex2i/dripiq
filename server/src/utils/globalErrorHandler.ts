import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { defaultErrorMessage } from '@/constants';
import { logger } from '@/libs/logger';

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const status: number = error.statusCode ?? 500;
    const message: string =
      status === 500 ? defaultErrorMessage : (error.message ?? defaultErrorMessage);

    logger.error(
      `[${request.method}] ${request.url} >> StatusCode:: ${status}, Message:: ${message}`,
      error
    );

    return reply.status(status).send({ error: true, message, status });
  } catch (error) {
    return reply
      .status(500)
      .send({ error: true, message: `Exception could not be handled: ${error}` });
  }
}
