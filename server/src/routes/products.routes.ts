import { FastifyInstance, RouteOptions, FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { defaultRouteResponse } from '@/types/response';
import { HttpMethods } from '@/utils/HttpMethods';
import { ProductsService } from '../modules/products.service';
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductGetSchema,
  ProductsListSchema,
  ProductDeleteSchema,
} from './apiSchema/product';

const basePath = '/products';

export default async function ProductsRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // GET /products - List all products
  fastify.route({
    method: HttpMethods.GET,
    preHandler: [fastify.authPrehandler],
    url: basePath,
    schema: {
      description: 'Get all products for a tenant',
      tags: ['Products'],
      ...ProductsListSchema,
      response: {
        ...ProductsListSchema.response,
        ...defaultRouteResponse(),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          title?: string;
          isDefault?: boolean;
          page?: number;
          limit?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { tenantId } = authenticatedRequest;

        const productsList = await ProductsService.getProducts(tenantId);
        return reply.send(productsList);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });

  // GET /products/:id - Get a single product
  fastify.route({
    method: HttpMethods.GET,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      description: 'Get a product by ID',
      tags: ['Products'],
      ...ProductGetSchema,
      response: {
        ...ProductGetSchema.response,
        ...defaultRouteResponse(),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const authenticatedRequest = request as AuthenticatedRequest;
        const { tenantId } = authenticatedRequest;

        const product = await ProductsService.getProduct(id, tenantId);
        if (!product) {
          return reply.status(404).send({ message: 'Product not found' });
        }

        return reply.send(product);
      } catch (error: any) {
        fastify.log.error(error);
        if (error.message === 'Access denied') {
          return reply.status(403).send({ message: 'Access denied' });
        }
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });

  // POST /products - Create a new product
  fastify.route({
    method: HttpMethods.POST,
    preHandler: [fastify.authPrehandler],
    url: basePath,
    schema: {
      description: 'Create a new product',
      tags: ['Products'],
      ...ProductCreateSchema,
      response: {
        ...ProductCreateSchema.response,
        ...defaultRouteResponse(),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          title: string;
          description?: string;
          salesVoice?: string;
          siteUrl?: string;
          isDefault?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { title, description, salesVoice, siteUrl, isDefault } = request.body;
        const authenticatedRequest = request as AuthenticatedRequest;
        const { tenantId } = authenticatedRequest;

        const newProduct = await ProductsService.createProduct(
          {
            title,
            tenantId,
            description: description ?? null,
            salesVoice: salesVoice ?? null,
            siteUrl: siteUrl ?? null,
            isDefault: isDefault || false,
          },
          tenantId
        );

        return reply.status(201).send(newProduct);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });

  // PUT /products/:id - Update a product
  fastify.route({
    method: HttpMethods.PUT,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      description: 'Update a product by ID',
      tags: ['Products'],
      ...ProductUpdateSchema,
      response: {
        ...ProductUpdateSchema.response,
        ...defaultRouteResponse(),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
        Body: {
          title?: string;
          description?: string;
          salesVoice?: string;
          siteUrl?: string;
          isDefault?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const updateData = request.body;
        const authenticatedRequest = request as AuthenticatedRequest;
        const { tenantId } = authenticatedRequest;

        const updatedProduct = await ProductsService.updateProduct(id, updateData, tenantId);
        return reply.send(updatedProduct);
      } catch (error: any) {
        fastify.log.error(error);
        if (error.message === 'Access denied') {
          return reply.status(403).send({ message: 'Access denied' });
        }
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });

  // DELETE /products/:id - Delete a product
  fastify.route({
    method: HttpMethods.DELETE,
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      description: 'Delete a product by ID',
      tags: ['Products'],
      ...ProductDeleteSchema,
      response: {
        ...ProductDeleteSchema.response,
        ...defaultRouteResponse(),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const authenticatedRequest = request as AuthenticatedRequest;
        const { tenantId } = authenticatedRequest;

        await ProductsService.deleteProduct(id, tenantId);

        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);
        if (error.message === 'Access denied') {
          return reply.status(403).send({ message: 'Access denied' });
        }
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });
}
