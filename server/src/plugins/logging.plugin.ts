import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

// Store request start times for response time calculation
const requestStartTimes = new Map<string, number>();

const loggingPlugin = async (fastify: FastifyInstance) => {
  // Log incoming requests with flattened properties
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Store request start time for response time calculation
    requestStartTimes.set(request.id, Date.now());

    const logData = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      host: request.headers.host,
      userAgent: request.headers['user-agent'],
      remoteAddress: request.ip,
      remotePort: (request.socket as any)?.remotePort,
      queryParams: Object.keys(request.query as object).length > 0 ? request.query : undefined,
    };

    fastify.log.info(logData, 'incoming request');
  });

  // Log outgoing responses with flattened properties
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = requestStartTimes.get(request.id);
    const responseTime = startTime ? Date.now() - startTime : undefined;
    
    // Clean up the stored start time
    requestStartTimes.delete(request.id);
    
    const logData = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
      contentLength: reply.getHeader('content-length'),
    };

    const level = reply.statusCode >= 400 ? 'warn' : 'info';
    fastify.log[level](logData, 'request completed');
  });

  // Log errors with flattened properties
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    // Clean up the stored start time on error
    requestStartTimes.delete(request.id);

    const logData = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };

    fastify.log.error(logData, 'request error');
  });
};

export default fp(loggingPlugin, {
  name: 'logging-plugin',
});