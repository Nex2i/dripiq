import { join } from 'path';
import Fastify from 'fastify';
import AutoLoad from '@fastify/autoload';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyCors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import fastifyHelmet from '@fastify/helmet';
import { schemaErrorFormatter } from '@/utils/schemaErrorFormatter';
import { CREDENTIALS } from '@/config';
import { schema } from '@/utils/validateEnv';
import '@/extensions';
import initIac from '@/utils/iac';
import { logger, loggerOptions } from '@/libs/logger';
import { globalErrorHandler } from '@/utils/globalErrorHandler';

async function startServer() {
  const app = Fastify({
    schemaErrorFormatter,
    ajv: {
      customOptions: {
        coerceTypes: true,
        allErrors: true,
      },
      plugins: [],
    },
    // Fastify v5 expects either boolean, a pino logger options object, or a Fastify-compatible logger
    // Passing the options object avoids the FST_ERR_LOG_INVALID_LOGGER_CONFIG error
    logger: loggerOptions,
    trustProxy: true,
    genReqId: (_req) => {
      // Generate a simple request ID
      return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Initialize Error Handling
  app.setErrorHandler(globalErrorHandler);

  // Initialize Plugins
  await app.register(fastifyEnv, { dotenv: true, schema });
  await app.register(fastifyCors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      // Allow any DripIQ domain
      if (origin.includes('.dripiq.ai')) {
        return callback(null, true);
      }

      // Allow base DripIQ domain
      if (origin.includes('dripiq.ai')) {
        return callback(null, true);
      }

      // Allow any other origin for now (you can make this more restrictive later)
      return callback(null, true);
    },
    credentials: CREDENTIALS === 'true',
    methods: '*',
    allowedHeaders: '*',
  });
  await app.register(fastifyHelmet);

  await app.register(AutoLoad, {
    dir: join(__dirname, '/plugins'),
    dirNameRoutePrefix: false,
  });

  // Initialize Routes - KEEP THIS AS THE LAST REGISTRED ITEM
  await app.register(AutoLoad, {
    dir: join(__dirname, '/routes'),
    dirNameRoutePrefix: false,
    options: { prefix: `/api` },
  });

  await initIac();

  return app;
}

export default startServer;

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
