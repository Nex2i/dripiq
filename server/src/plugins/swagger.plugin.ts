import { FastifyInstance } from 'fastify';
import fastifySwagger, { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import fastifySwaggerUi, { FastifySwaggerUiOptions } from '@fastify/swagger-ui';
import { fastifyPlugin } from 'fastify-plugin';

export default fastifyPlugin((fastify: FastifyInstance, _: unknown, done: () => void) => {
  const opts: FastifyDynamicSwaggerOptions = {
    swagger: {
      info: {
        title: 'Fastify Swagger',
        description: 'Swagger documentation for APIs in the boilerplate',
        version: '1.0.0',
      },
      tags: [
        {
          name: 'Authentication',
          description: 'Authentication related endpoints',
        },
        { name: 'Ping', description: 'Health check endpoint' },
      ],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
        },
      },
      schemes: ['http', 'https'],
      // Apply bearerAuth security globally to all routes
      security: [{ bearerAuth: [] }],
    },
  };

  fastify.register(fastifySwagger, opts);

  const uiOpts: FastifySwaggerUiOptions = {
    routePrefix: '/api-docs',
    staticCSP: true,
    transformStaticCSP: (header) => header,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  };

  fastify.register(fastifySwaggerUi, uiOpts);
  done();
});
