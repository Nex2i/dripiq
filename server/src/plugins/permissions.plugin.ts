import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { RoleService } from '@/modules/role.service';

declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (resource: string, action: string) => (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    requireAdmin: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function permissionsPlugin(fastify: FastifyInstance) {
  // Middleware to check if user has specific permission
  fastify.decorate(
    'requirePermission',
    (resource: string, action: string) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          // Get user from auth middleware
          const user = (request as any).user;
          if (!user?.id) {
            reply.status(401).send({ message: 'Authentication required' });
            return;
          }

          // Get tenant from request (could be in params, query, or body)
          const tenantId = getTenantFromRequest(request);
          if (!tenantId) {
            reply.status(400).send({ message: 'Tenant ID required' });
            return;
          }

          // Get user from database using Supabase ID
          const dbUser = await fastify.userService.getUserBySupabaseId(user.id);
          if (!dbUser) {
            reply.status(404).send({ message: 'User not found' });
            return;
          }

          // Check if user has the required permission
          const hasPermission = await RoleService.userHasPermission(
            dbUser.id,
            tenantId,
            resource,
            action
          );

          if (!hasPermission) {
            reply.status(403).send({
              message: 'Insufficient permissions',
              required: { resource, action },
            });
            return;
          }

          // Permission check passed, continue to route handler
        } catch (error: any) {
          fastify.log.error(`Permission check error: ${error.message}`);
          reply.status(500).send({ message: 'Permission check failed' });
        }
      }
  );

  // Middleware to check if user is admin
  fastify.decorate(
    'requireAdmin',
    () => async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get user from auth middleware
        const user = (request as any).user;
        if (!user?.id) {
          reply.status(401).send({ message: 'Authentication required' });
          return;
        }

        // Get tenant from request
        const tenantId = getTenantFromRequest(request);
        if (!tenantId) {
          reply.status(400).send({ message: 'Tenant ID required' });
          return;
        }

        // Get user from database using Supabase ID
        const dbUser = await fastify.userService.getUserBySupabaseId(user.id);
        if (!dbUser) {
          reply.status(404).send({ message: 'User not found' });
          return;
        }

        // Check if user is admin
        const isAdmin = await RoleService.userIsAdmin(dbUser.id, tenantId);

        if (!isAdmin) {
          reply.status(403).send({
            message: 'Admin access required',
          });
          return;
        }

        // Admin check passed, continue to route handler
      } catch (error: any) {
        fastify.log.error(`Admin check error: ${error.message}`);
        reply.status(500).send({ message: 'Admin check failed' });
      }
    }
  );
}

/**
 * Helper function to extract tenant ID from request
 * Looks in params, query, and body in that order
 */
function getTenantFromRequest(request: FastifyRequest): string | null {
  // Check params first (e.g., /api/tenants/:tenantId/campaigns)
  const params = request.params as any;
  if (params?.tenantId) {
    return params.tenantId;
  }

  // Check query parameters (e.g., ?tenantId=123)
  const query = request.query as any;
  if (query?.tenantId) {
    return query.tenantId;
  }

  // Check request body
  const body = request.body as any;
  if (body?.tenantId) {
    return body.tenantId;
  }

  // Check headers (custom header)
  const headers = request.headers;
  if (headers['x-tenant-id']) {
    return headers['x-tenant-id'] as string;
  }

  return null;
}

export default fp(permissionsPlugin, {
  name: 'permissions',
  dependencies: ['authentication'],
});