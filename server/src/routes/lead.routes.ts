import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { LeadAnalyzerService } from '@/modules/ai/leadAnalyzer.service';
import { defaultRouteResponse } from '@/types/response';
import { LeadVendorFitService } from '@/modules/ai/leadVendorFit.service';
import { generateContactStrategy } from '@/modules/ai';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  getLeadById,
  assignLeadOwner,
} from '../modules/lead.service';
import {
  getLeadProducts,
  attachProductsToLead,
  detachProductFromLead,
} from '../modules/leadProduct.service';
import { NewLead } from '../db/schema';
import { AuthenticatedRequest } from '../plugins/authentication.plugin';

// Import all lead schemas
import {
  LeadCreateSchema,
  LeadGetAllSchema,
  LeadGetByIdSchema,
  LeadUpdateSchema,
  LeadDeleteSchema,
  LeadBulkDeleteSchema,
  LeadAssignOwnerSchema,
  LeadVendorFitSchema,
  LeadResyncSchema,
  LeadContactStrategySchema,
  LeadAttachProductsSchema,
  LeadDetachProductSchema,
  LeadGetProductsSchema,
} from './apiSchema/lead';

const basePath = '/leads';

export default async function LeadRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get all leads route
  fastify.route({
    method: HttpMethods.GET,
    url: basePath,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Get All Leads',
      description: 'Retrieve all leads from the database with optional search (tenant-scoped)',
      ...LeadGetAllSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadGetAllSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          search?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { search } = request.query;

        const leads = await getLeads(authenticatedRequest.tenantId, search);

        reply.send(leads);
      } catch (error: any) {
        fastify.log.error(`Error fetching leads: ${error.message}`);

        if (
          error.message?.includes('access to tenant') ||
          error.message?.includes('ForbiddenError')
        ) {
          reply.status(403).send({
            message: 'Access denied to tenant resources',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to fetch leads',
          error: error.message,
        });
      }
    },
  });

  // Create new lead route
  fastify.route({
    method: HttpMethods.POST,
    url: basePath,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Create New Lead',
      description:
        'Create a new lead in the database with optional point of contacts (tenant-scoped)',
      ...LeadCreateSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadCreateSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          name: string;
          url: string;
          status?: string;
          ownerId?: string;
          pointOfContacts?: Array<{
            name: string;
            email: string;
            phone?: string;
            title?: string;
            company?: string;
          }>;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { pointOfContacts, ownerId, ...leadData } = request.body;

        // Validate required fields (additional validation beyond schema)
        if (!leadData.name?.trim()) {
          reply.status(400).send({
            message: 'Lead name is required',
            error: 'Name cannot be empty',
          });
          return;
        }

        if (!leadData.url?.trim()) {
          reply.status(400).send({
            message: 'Lead URL is required',
            error: 'URL cannot be empty',
          });
          return;
        }

        // Owner is required; validate presence
        if (!ownerId || !ownerId.trim()) {
          reply.status(400).send({
            message: 'Assigned owner is required',
            error: 'ownerId must be provided',
          });
          return;
        }

        // Create the lead with tenant context and point of contacts
        const newLead = await createLead(
          authenticatedRequest.tenantId,
          leadData as Omit<NewLead, 'tenantId'>,
          ownerId,
          pointOfContacts
        );

        if (!newLead) {
          fastify.log.error('Lead creation failed - no lead returned from database');
          reply.status(500).send({
            message: 'Failed to create lead',
            error: 'Database operation failed',
          });
          return;
        }

        // Index the lead's site after creation
        await LeadAnalyzerService.indexSite(authenticatedRequest.tenantId, newLead.id);

        reply.status(201).send({
          message: 'Lead created successfully',
          lead: newLead,
        });
      } catch (error: any) {
        fastify.log.error(`Error creating lead: ${error.message}`);

        // Check for tenant access errors
        if (
          error.message?.includes('access to tenant') ||
          error.message?.includes('ForbiddenError')
        ) {
          reply.status(403).send({
            message: 'Access denied to tenant resources',
            error: error.message,
          });
          return;
        }

        // Validation: owner must be verified
        if (error.message?.includes('verified sender identity')) {
          reply.status(400).send({
            message: 'Assigned owner must be verified',
            error: error.message,
          });
          return;
        }

        // Check for specific database errors
        if (error.message?.includes('duplicate') || error.code === '23505') {
          reply.status(400).send({
            message: 'Lead with this information already exists',
            error: 'Duplicate data',
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to create lead',
          error: error.message,
        });
      }
    },
  });

  // Get single lead route
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/:id`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Get Lead by ID',
      description: 'Get a single lead by ID with associated point of contacts (tenant-scoped)',
      ...LeadGetByIdSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadGetByIdSchema.response,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params as { id: string };
        const lead = await getLeadById(authenticatedRequest.tenantId, id);
        reply.send(lead);
      } catch (error: any) {
        fastify.log.error(`Error fetching lead: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch lead',
          error: error.message,
        });
      }
    },
  });

  // Update lead route
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:id`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Update Lead',
      description: 'Update a lead in the database (tenant-scoped)',
      ...LeadUpdateSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadUpdateSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: Partial<NewLead>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;
        const updatedLead = await updateLead(
          authenticatedRequest.tenantId,
          id,
          request.body as Partial<Omit<NewLead, 'tenantId'>>
        );

        reply.send(updatedLead);
      } catch (error: any) {
        fastify.log.error(`Error updating lead: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to update lead',
          error: error.message,
        });
      }
    },
  });

  // Delete lead route
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/:id`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Delete Lead',
      description: 'Delete a lead from the database (tenant-scoped)',
      ...LeadDeleteSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadDeleteSchema.response,
      },
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;
        const deleted = await deleteLead(authenticatedRequest.tenantId, id);
        reply.send({ message: 'Lead deleted successfully', lead: deleted });
      } catch (error: any) {
        fastify.log.error(`Error deleting lead: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to delete lead',
          error: error.message,
        });
      }
    },
  });

  // Bulk delete route
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/bulk`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Bulk Delete Leads',
      description: 'Delete multiple leads from the database (tenant-scoped)',
      ...LeadBulkDeleteSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadBulkDeleteSchema.response,
      },
    },
    handler: async (request: FastifyRequest<{ Body: { ids: string[] } }>, reply: FastifyReply) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { ids } = request.body;
        const results = await bulkDeleteLeads(authenticatedRequest.tenantId, ids);
        reply.send({ deletedCount: results.length, deletedLeads: results });
      } catch (error: any) {
        fastify.log.error(`Error bulk deleting leads: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to bulk delete leads',
          error: error.message,
        });
      }
    },
  });

  // Vendor fit route
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/:id/vendor-fit`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Generate Vendor Fit Report',
      ...LeadVendorFitSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadVendorFitSchema.response,
      },
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;

        const vendorFitReport = await LeadVendorFitService.generateVendorFitReport(
          authenticatedRequest.tenantId,
          id
        );

        reply.status(200).send({
          message: 'Vendor fit report generated successfully',
          vendorFitReport,
        });
      } catch (error: any) {
        fastify.log.error(`Error generating vendor fit report: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to generate vendor fit report',
          error: error.message,
        });
      }
    },
  });

  // Resync lead route
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/:id/resync`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Resync Lead',
      description: "Re-index and analyze a lead's site (tenant-scoped)",
      ...LeadResyncSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadResyncSchema.response,
      },
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;

        await LeadAnalyzerService.indexSite(authenticatedRequest.tenantId, id);

        reply.send({ message: 'Lead resync initiated', leadId: id });
      } catch (error: any) {
        fastify.log.error(`Error resyncing lead: ${error.message}`);

        reply.status(500).send({
          message: 'Failed to resync lead',
          error: error.message,
        });
      }
    },
  });

  // Assign lead owner route
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:id/assign-owner`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Assign Lead Owner',
      description: 'Assign a user as the owner of a lead (tenant-scoped)',
      ...LeadAssignOwnerSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadAssignOwnerSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
        Body: {
          userId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;
        const { userId } = request.body;

        if (!id || !id.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid ID',
          });
          return;
        }

        if (!userId || !userId.trim()) {
          reply.status(400).send({
            message: 'User ID is required',
            error: 'Invalid user ID',
          });
          return;
        }

        // Assign the owner to the lead
        const updatedLead = await assignLeadOwner(authenticatedRequest.tenantId, id, userId);

        fastify.log.info(
          `Lead owner assigned successfully. Lead ID: ${id}, User ID: ${userId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Lead owner assigned successfully',
          lead: updatedLead,
        });
      } catch (error: any) {
        fastify.log.error(`Error assigning lead owner: ${error.message}`);

        if (
          error.message?.includes('access to tenant') ||
          error.message?.includes('ForbiddenError')
        ) {
          reply.status(403).send({
            message: 'Access denied to tenant resources',
            error: error.message,
          });
          return;
        }

        if (error.message?.includes('Lead not found')) {
          reply.status(404).send({
            message: 'Lead not found',
            error: error.message,
          });
          return;
        }

        if (error.message?.includes('User not found')) {
          reply.status(400).send({
            message: 'User not found in this tenant',
            error: error.message,
          });
          return;
        }

        if (error.message?.includes('verified sender identity')) {
          reply.status(400).send({
            message: 'Assigned owner must be verified',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to assign lead owner',
          error: error.message,
        });
      }
    },
  });

  // Contact strategy endpoint
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:leadId/contacts/:contactId/contact-strategy`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Generate contact strategy and outreach plan for a specific contact',
      tags: ['Leads'],
      ...LeadContactStrategySchema,
      response: {
        ...LeadContactStrategySchema.response,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const { leadId, contactId } = request.params as { leadId: string; contactId: string };
      const userId = user?.id;

      try {
        const result = await generateContactStrategy({
          leadId,
          contactId,
          tenantId,
          userId,
        });

        // Return the campaign plan JSON directly per new schema
        reply.status(200).send(result.finalResponseParsed);
      } catch (error: any) {
        fastify.log.error(`Error qualifying lead contact: ${error.message}`);

        if (error.message?.includes('Access denied')) {
          reply.status(403).send({
            success: false,
            message: 'Access denied to tenant resources',
          });
          return;
        }

        reply.status(500).send({ success: false, message: 'Failed to generate contact strategy' });
      }
    },
  });

  // Get lead products route
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/:leadId/products`,
    schema: {
      tags: ['Lead Products'],
      summary: 'Get Lead Products',
      description: 'Get all products attached to a specific lead (tenant-scoped)',
      ...LeadGetProductsSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadGetProductsSchema.response,
      },
    },
    preHandler: [fastify.authPrehandler],
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId } = request.params;

        fastify.log.info(
          `Getting products for lead: ${leadId} for tenant: ${authenticatedRequest.tenantId}`
        );

        const leadProducts = await getLeadProducts(leadId, authenticatedRequest.tenantId);

        fastify.log.info(`Retrieved ${leadProducts.length} products for lead: ${leadId}`);

        reply.send(leadProducts);
      } catch (error: any) {
        fastify.log.error(`Error getting lead products: ${error.message}`);

        if (error.message?.includes('not found') || error.message?.includes('access denied')) {
          reply.status(404).send({
            success: false,
            message: 'Lead not found or access denied',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          success: false,
          message: 'Failed to get lead products',
          error: error.message,
        });
      }
    },
  });

  // Attach products to lead route
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/:leadId/products`,
    schema: {
      tags: ['Lead Products'],
      summary: 'Attach Products to Lead',
      description: 'Attach one or more products to a lead (tenant-scoped)',
      ...LeadAttachProductsSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadAttachProductsSchema.response,
      },
    },
    preHandler: [fastify.authPrehandler],
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
        };
        Body: {
          productIds: string[];
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId } = request.params;
        const { productIds } = request.body;

        const attachments = await attachProductsToLead(
          leadId,
          productIds,
          authenticatedRequest.tenantId
        );

        reply.status(201).send({
          success: true,
          message: `Successfully attached ${attachments.length} product(s) to lead`,
          attachedCount: attachments.length,
          attachments,
        });
      } catch (error: any) {
        fastify.log.error(`Error attaching products to lead: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to attach products to lead',
          error: error.message,
        });
      }
    },
  });

  // Detach product from lead route (legacy path)
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/:leadId/products/:productId`,
    schema: {
      tags: ['Lead Products'],
      summary: 'Detach Product from Lead',
      description: 'Detach a specific product from a lead (tenant-scoped)',
      ...LeadDetachProductSchema,
      response: {
        ...defaultRouteResponse(),
        ...LeadDetachProductSchema.response,
      },
    },
    preHandler: [fastify.authPrehandler],
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
          productId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId, productId } = request.params;

        const detached = await detachProductFromLead(
          leadId,
          productId,
          authenticatedRequest.tenantId
        );

        if (!detached) {
          reply.status(404).send({
            success: false,
            message: 'Product attachment not found',
            error: 'The specified product is not attached to this lead',
          });
          return;
        }

        reply.send({ success: true, message: 'Product successfully detached from lead' });
      } catch (error: any) {
        fastify.log.error(`Error detaching product from lead: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to detach product from lead',
          error: error.message,
        });
      }
    },
  });
}
