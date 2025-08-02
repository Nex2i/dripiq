import { FastifyInstance, FastifyRequest, RouteOptions } from 'fastify';
import { Static } from '@sinclair/typebox';
import { TenantService } from '@/modules/tenant.service';
import { OrganizationAnalyzerService } from '@/modules/ai/organizationAnalyzer.service';
import { storageService } from '@/modules/storage/storage.service';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { defaultRouteResponse } from '@/types/response';

// Import organization schemas
import {
  OrganizationGetSchema,
  OrganizationUpdateSchema,
  OrganizationAnalyzeSchema,
  GetOrganizationParamsSchema,
  UpdateOrganizationParamsSchema,
  UpdateOrganizationRequestSchema,
  AnalyzeOrganizationParamsSchema,
} from './apiSchema/organization';

const basePath = '/organizations';

export default async function OrganizationRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // GET /organizations/:id - Get organization details
  fastify.route({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      tags: ['Organizations'],
      summary: 'Get Organization Details',
      description: 'Retrieve organization details by ID',
      ...OrganizationGetSchema,
      response: {
        ...defaultRouteResponse(),
        ...OrganizationGetSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: Static<typeof GetOrganizationParamsSchema>;
      }>,
      reply
    ) => {
      try {
        const { tenantId } = request as AuthenticatedRequest;

        const tenant = await TenantService.getTenantById(tenantId);

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
          logo: await generateOrganizationLogoSignedUrl(tenantId, tenant.website),
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
  fastify.route({
    method: 'PUT',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id`,
    schema: {
      tags: ['Organizations'],
      summary: 'Update Organization',
      description: 'Update organization details',
      ...OrganizationUpdateSchema,
      response: {
        ...defaultRouteResponse(),
        ...OrganizationUpdateSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: Static<typeof UpdateOrganizationParamsSchema>;
        Body: Static<typeof UpdateOrganizationRequestSchema>;
      }>,
      reply
    ) => {
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
  fastify.route({
    method: 'POST',
    preHandler: [fastify.authPrehandler],
    url: `${basePath}/:id/resync`,
    schema: {
      tags: ['Organizations'],
      summary: 'Resync Organization',
      description: 'Analyze and resync organization details',
      ...OrganizationAnalyzeSchema,
      response: {
        ...defaultRouteResponse(),
        ...OrganizationAnalyzeSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: Static<typeof AnalyzeOrganizationParamsSchema>;
      }>,
      reply
    ) => {
      try {
        const { id } = request.params;
        const { tenantId } = request as AuthenticatedRequest;

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
