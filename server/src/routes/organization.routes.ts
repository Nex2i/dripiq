import { FastifyInstance, RouteOptions } from 'fastify';
import { TenantService } from '@/modules/tenant.service';
import { OrganizationAnalyzerService } from '@/modules/ai/organizationAnalyzer.service';

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
        const user = (request as any).user;

        const tenant = await TenantService.getTenantByIdSecure(user.id, id);

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
        const user = (request as any).user;
        const updateData = request.body;

        const updatedTenant = await TenantService.updateTenant(user.id, id, updateData);

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

  // POST /organizations/:id/resync - Resync organization details
  fastify.route<{
    Params: OrganizationParams;
  }>({
    method: 'POST',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id/resync`,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const tenantId = (request as any).tenantId;

        if (tenantId !== id) {
          return reply
            .status(403)
            .send({ message: 'You are not authorized to resync this organization' });
        }

        const siteAnalyzerResult = await OrganizationAnalyzerService.analyzeOrganization(tenantId);
        return reply.status(200).send({
          message: 'Organization details resynced successfully',
          id: tenantId,
          siteAnalyzerResult,
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
}
