import { FastifyInstance, RouteOptions } from 'fastify';
import { TenantService } from '@/modules/tenant.service';

const basePath = '/organizations';

interface OrganizationParams {
  id: string;
}

interface UpdateOrganizationBody {
  name?: string;
  organizationName?: string;
  organizationWebsite?: string;
}

export default async function OrganizationRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // GET /organizations/:id - Get organization details
  fastify.route<{
    Params: OrganizationParams;
  }>({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const supabaseUser = (request as any).user;

        if (!supabaseUser?.id) {
          return reply.status(401).send({ message: 'Authentication required' });
        }

        // Get database user from Supabase user
        const { UserService } = await import('@/modules/user.service');
        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
        if (!dbUser) {
          return reply.status(404).send({ message: 'User not found' });
        }

        const tenant = await TenantService.getTenantByIdSecure(dbUser.id, id);

        if (!tenant) {
          return reply.status(404).send({ message: 'Organization not found' });
        }

        // Return organization data with the structure expected by frontend
        return reply.send({
          id: tenant.id,
          tenantName: tenant.name,
          organizationName: tenant.organizationName || '',
          organizationWebsite: tenant.organizationWebsite || '',
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });

  // PUT /organizations/:id - Update organization details
  fastify.route<{
    Params: OrganizationParams;
    Body: UpdateOrganizationBody;
  }>({
    method: 'PUT',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const supabaseUser = (request as any).user;
        const updateData = request.body;

        if (!supabaseUser?.id) {
          return reply.status(401).send({ message: 'Authentication required' });
        }

        // Get database user from Supabase user
        const { UserService } = await import('@/modules/user.service');
        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
        if (!dbUser) {
          return reply.status(404).send({ message: 'User not found' });
        }

        const updatedTenant = await TenantService.updateTenant(dbUser.id, id, updateData);

        // Return updated organization data
        return reply.send({
          id: updatedTenant.id,
          tenantName: updatedTenant.name,
          organizationName: updatedTenant.organizationName || '',
          organizationWebsite: updatedTenant.organizationWebsite || '',
        });
      } catch (error: any) {
        fastify.log.error(error);
        if (error.message.includes('not found') || error.message.includes('access')) {
          return reply.status(404).send({ message: error.message });
        }
        return reply.status(500).send({
          message: 'Internal server error',
          error: error.message,
        });
      }
    },
  });
}
