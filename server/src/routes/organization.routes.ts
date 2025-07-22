import { FastifyInstance, RouteOptions } from 'fastify';
import { TenantService } from '@/modules/tenant.service';
import { OrganizationAnalyzerService } from '@/modules/ai/organizationAnalyzer.service';
import { storageService } from '@/modules/storage/storage.service';

const basePath = '/organizations';

interface OrganizationParams {
  id: string;
}

interface UpdateOrganizationBody {
  name?: string;
  organizationName?: string;
  organizationWebsite?: string;
  summary?: string;
  differentiators?: string[];
  targetMarket?: string;
  tone?: string;
  logo?: string | null;
  brandColors?: string[];
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
          organizationWebsite: tenant.website || '',
          summary: tenant.summary || '',
          products: [], // TODO: Get products from products table
          services: [], // Services removed from schema
          differentiators: tenant.differentiators || [],
          targetMarket: tenant.targetMarket || '',
          tone: tenant.tone || '',
          logo: await generateOrganizationLogoSignedUrl(id, tenant.website),
          brandColors: tenant.brandColors || [],
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
        const updateData = request.body;

        // Map frontend field names to database field names
        const mappedUpdateData = {
          ...updateData,
          organizationWebsite: undefined, // Remove frontend field name
          website: updateData.organizationWebsite, // Map to database field name
        };

        const updatedTenant = await TenantService.updateTenant(id, mappedUpdateData);

        // Return updated organization data
        return reply.send({
          id: updatedTenant.id,
          tenantName: updatedTenant.name,
          organizationName: updatedTenant.organizationName || '',
          organizationWebsite: updatedTenant.website || '',
          summary: updatedTenant.summary || '',
          products: [], // TODO: Get products from products table
          services: [], // Services removed from schema
          differentiators: updatedTenant.differentiators || [],
          targetMarket: updatedTenant.targetMarket || '',
          tone: updatedTenant.tone || '',
          logo: await generateOrganizationLogoSignedUrl(id, updatedTenant.website),
          brandColors: updatedTenant.brandColors || [],
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
        const user = (request as any).user;
        const tenantId = (request as any).tenantId;

        if (tenantId !== id) {
          return reply
            .status(403)
            .send({ message: 'You are not authorized to resync this organization' });
        }

        const siteAnalyzerResult = await OrganizationAnalyzerService.indexSite(tenantId);
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

  async function generateOrganizationLogoSignedUrl(tenantId: string, domain?: string | null) {
    const storagePath = storageService.getTenantDomainLogoKey(tenantId, domain);

    return await storageService.getSignedUrl(storagePath);
  }
}
