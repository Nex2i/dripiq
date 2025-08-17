import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '@/libs/logger';

// Store request start times for response time calculation
const requestStartTimes = new Map<string, number>();

const ignoredMethods = ['OPTIONS', 'HEAD'];
const ignoredPaths = ['/health', '/metrics', '/admin/queues'];

const loggingPlugin = async (fastify: FastifyInstance) => {
  // Log incoming requests with structured data
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Store request start time for response time calculation
    requestStartTimes.set(request.id, Date.now());

    if (shouldUrlBeIgnored(request.url)) {
      return;
    }

    if (ignoredMethods.includes(request.method)) {
      return;
    }

    const logData = {
      reqId: request.id,
      req: {
        method: request.method,
        url: request.url,
        host: request.headers.host,
        userAgent: request.headers['user-agent'],
        remoteAddress: request.ip,
        remotePort: (request.socket as any)?.remotePort,
        queryParams: Object.keys(request.query as object).length > 0 ? request.query : undefined,
      },
    };

    logger.info(`incoming request ${request.method} ${request.url}`, logData);
  });

  // Log outgoing responses with structured data
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = requestStartTimes.get(request.id);
    const responseTime = startTime ? Date.now() - startTime : undefined;

    if (shouldUrlBeIgnored(request.url)) {
      return;
    }

    // Clean up the stored start time
    requestStartTimes.delete(request.id);

    const logData = {
      reqId: request.id,
      req: {
        method: request.method,
        url: request.url,
      },
      res: {
        statusCode: reply.statusCode,
        responseTime,
        contentLength: reply.getHeader('content-length'),
      },
    };

    const level = reply.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`request completed ${request.method} ${request.url}`, logData);
  });

  // Log errors with structured data
  fastify.addHook(
    'onError',
    async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
      // Clean up the stored start time on error
      requestStartTimes.delete(request.id);

      const logData = {
        reqId: request.id,
        req: {
          method: request.method,
          url: request.url,
        },
        err: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };

      logger.error(`request error ${request.method} ${request.url}`, logData);
    }
  );
};

function shouldUrlBeIgnored(url: string) {
  for (const ignoredPath of ignoredPaths) {
    if (url.includes(ignoredPath)) {
      return true;
    }
  }
  return false;
}

export default fp(loggingPlugin, {
  name: 'logging-plugin',
});
