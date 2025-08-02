import { FastifyInstance, RouteOptions } from 'fastify';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { ProductsService } from '../modules/products.service';

const basePath = '/products';

interface CreateProductBody {
  title: string;
  description?: string;
  salesVoice?: string;
  siteUrl?: string;
  isDefault?: boolean;
  tenantId: string;
}

interface UpdateProductBody {
  title?: string;
  description?: string;
  salesVoice?: string;
  siteUrl?: string;
  isDefault?: boolean;
}

interface ProductParams {
  id: string;
}

interface ProductQuery {
  tenantId: string;
}

export default async function ProductsRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  fastify.route<{
    Querystring: ProductQuery;
  }>({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: basePath,
    handler: async (request, reply) => {
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
  fastify.route<{
    Params: ProductParams;
  }>({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    handler: async (request, reply) => {
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
  fastify.route<{
    Body: CreateProductBody;
  }>({
    method: 'POST',
    preHandler: [fastify.authPrehandler],
    url: basePath,
    handler: async (request, reply) => {
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
  fastify.route<{
    Params: ProductParams;
    Body: UpdateProductBody;
  }>({
    method: 'PUT',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    handler: async (request, reply) => {
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
  fastify.route<{
    Params: ProductParams;
  }>({
    method: 'DELETE',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    handler: async (request, reply) => {
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
