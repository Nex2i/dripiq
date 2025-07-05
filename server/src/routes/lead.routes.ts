import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { LeadAnalyzerService } from '@/modules/ai/leadAnalyzer.service';
import { defaultRouteResponse } from '@/types/response';
import { LeadVendorFitService } from '@/modules/ai/leadVendorFit.service';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  getLeadById,
} from '../modules/lead.service';
import { NewLead } from '../db/schema';
import { AuthenticatedRequest } from '../plugins/authentication.plugin';

const basePath = '/leads';

// Schema for point of contact
const pointOfContactSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Contact name' }),
  email: Type.String({ format: 'email', description: 'Contact email address' }),
  phone: Type.Optional(Type.String({ description: 'Contact phone number' })),
  title: Type.Optional(Type.String({ description: 'Contact job title' })),
  company: Type.Optional(Type.String({ description: 'Contact company' })),
});

// Schema for point of contact response
const pointOfContactResponseSchema = Type.Object({
  id: Type.String({ description: 'Contact ID' }),
  name: Type.String({ description: 'Contact name' }),
  email: Type.String({ description: 'Contact email' }),
  phone: Type.Optional(Type.String({ description: 'Contact phone' })),
  title: Type.Optional(Type.String({ description: 'Contact job title' })),
  company: Type.Optional(Type.String({ description: 'Contact company' })),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

// Schema for create lead endpoint
const createLeadBodySchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Lead name' }),
  url: Type.String({ format: 'uri', minLength: 1, description: 'Lead website URL' }),
  status: Type.Optional(
    Type.String({
      enum: ['new', 'contacted', 'qualified', 'lost'],
      default: 'new',
      description: 'Lead status',
    })
  ),
  pointOfContacts: Type.Optional(
    Type.Array(pointOfContactSchema, {
      description: 'Array of point of contacts for the lead',
    })
  ),
});

// Schema for lead response
const leadResponseSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
  name: Type.String({ description: 'Lead name' }),
  url: Type.String({ description: 'Lead website URL' }),
  status: Type.String({ description: 'Lead status' }),
  summary: Type.Optional(Type.String({ description: 'Lead summary' })),
  products: Type.Optional(Type.Array(Type.String(), { description: 'Lead products' })),
  services: Type.Optional(Type.Array(Type.String(), { description: 'Lead services' })),
  differentiators: Type.Optional(
    Type.Array(Type.String(), { description: 'Lead differentiators' })
  ),
  targetMarket: Type.Optional(Type.String({ description: 'Lead target market' })),
  tone: Type.Optional(Type.String({ description: 'Lead tone' })),
  logo: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Lead logo URL' })),
  brandColors: Type.Optional(Type.Array(Type.String(), { description: 'Lead brand colors' })),
  primaryContactId: Type.Optional(Type.String({ description: 'Primary contact ID' })),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  pointOfContacts: Type.Optional(
    Type.Array(pointOfContactResponseSchema, {
      description: 'Array of point of contacts for the lead',
    })
  ),
});

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
      querystring: Type.Object({
        search: Type.Optional(Type.String({ description: 'Search term to filter leads' })),
      }),
      response: {
        ...defaultRouteResponse(),
        200: Type.Array(leadResponseSchema, { description: 'List of leads for the tenant' }),
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
      body: createLeadBodySchema,
      tags: ['Leads'],
      summary: 'Create New Lead',
      description:
        'Create a new lead in the database with optional point of contacts (tenant-scoped)',
      response: {
        ...defaultRouteResponse(),
        201: Type.Object({
          message: Type.String(),
          lead: leadResponseSchema,
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          name: string;
          url: string;
          status?: string;
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
        const { pointOfContacts, ...leadData } = request.body;

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

        // Create the lead with tenant context and point of contacts
        const newLead = await createLead(
          authenticatedRequest.tenantId,
          leadData as Omit<NewLead, 'tenantId'>,
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

        // analyze lead
        await LeadAnalyzerService.analyzeLead(authenticatedRequest.tenantId, newLead.id);

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
      params: Type.Object({
        id: Type.String({ description: 'Lead ID' }),
      }),
      tags: ['Leads'],
      summary: 'Get Lead by ID',
      description: 'Get a single lead by ID with associated point of contacts (tenant-scoped)',
      response: {
        ...defaultRouteResponse(),
        200: leadResponseSchema,
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
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;

        if (!id || !id.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid ID',
          });
          return;
        }

        const lead = await getLeadById(authenticatedRequest.tenantId, id);

        if (!lead) {
          reply.status(404).send({
            message: 'Lead not found',
            error: `No lead found with ID: ${id} in tenant: ${authenticatedRequest.tenantId}`,
          });
          return;
        }

        reply.send(lead);
      } catch (error: any) {
        fastify.log.error(`Error fetching lead: ${error.message}`);

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
      params: Type.Object({
        id: Type.String({ description: 'Lead ID' }),
      }),
      body: Type.Partial(createLeadBodySchema),
      tags: ['Leads'],
      summary: 'Update Lead',
      description: 'Update a lead by ID (tenant-scoped)',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          message: Type.String(),
          lead: leadResponseSchema,
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
        Body: Partial<{
          name: string;
          url: string;
          status?: string;
          pointOfContacts?: Array<{
            name: string;
            email: string;
            phone?: string;
            title?: string;
            company?: string;
          }>;
        }>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;
        const { ...updateData } = request.body;

        if (!id || !id.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid ID',
          });
          return;
        }

        // For now, just update the lead data (not handling point of contacts updates in this route)
        const updatedLead = await updateLead(authenticatedRequest.tenantId, id, updateData);

        if (!updatedLead) {
          reply.status(404).send({
            message: 'Lead not found',
            error: `No lead found with ID: ${id} in tenant: ${authenticatedRequest.tenantId}`,
          });
          return;
        }

        // Get the updated lead with point of contacts
        const leadWithContacts = await getLeadById(authenticatedRequest.tenantId, id);

        fastify.log.info(
          `Lead updated successfully with ID: ${id} for tenant: ${authenticatedRequest.tenantId}`
        );

        reply.send({
          message: 'Lead updated successfully',
          lead: leadWithContacts,
        });
      } catch (error: any) {
        fastify.log.error(`Error updating lead: ${error.message}`);

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
          message: 'Failed to update lead',
          error: error.message,
        });
      }
    },
  });

  // Delete single lead route
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/:id`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: Type.Object({
        id: Type.String({ description: 'Lead ID' }),
      }),
      tags: ['Leads'],
      summary: 'Delete Lead',
      description: 'Delete a single lead by ID (tenant-scoped)',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          message: Type.String(),
          deletedLead: leadResponseSchema,
        }),
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
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;

        if (!id || !id.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid ID',
          });
          return;
        }

        const deletedLead = await deleteLead(authenticatedRequest.tenantId, id);

        if (!deletedLead) {
          reply.status(404).send({
            message: 'Lead not found',
            error: `No lead found with ID: ${id} in tenant: ${authenticatedRequest.tenantId}`,
          });
          return;
        }

        fastify.log.info(
          `Lead deleted successfully with ID: ${id} for tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Lead deleted successfully',
          deletedLead,
        });
      } catch (error: any) {
        fastify.log.error(`Error deleting lead: ${error.message}`);

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
          message: 'Failed to delete lead',
          error: error.message,
        });
      }
    },
  });

  // Bulk delete leads route
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/bulk`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: Type.Object({
        ids: Type.Array(Type.String(), { minItems: 1, description: 'Array of lead IDs to delete' }),
      }),
      tags: ['Leads'],
      summary: 'Bulk Delete Leads',
      description: 'Delete multiple leads by their IDs (tenant-scoped)',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          message: Type.String(),
          deletedLeads: Type.Array(leadResponseSchema),
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          ids: string[];
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { ids } = request.body;

        // Validate that IDs array is not empty
        if (!ids || ids.length === 0) {
          reply.status(400).send({
            message: 'At least one lead ID is required',
            error: 'IDs array cannot be empty',
          });
          return;
        }

        // Validate that all IDs are strings
        if (!ids.every((id) => typeof id === 'string' && id.trim())) {
          reply.status(400).send({
            message: 'All lead IDs must be valid strings',
            error: 'Invalid ID format',
          });
          return;
        }

        // Delete the leads with tenant context
        const deletedLeads = await bulkDeleteLeads(authenticatedRequest.tenantId, ids);

        fastify.log.info(
          `Bulk deleted ${deletedLeads.length} leads for tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: `Successfully deleted ${deletedLeads.length} lead(s)`,
          deletedCount: deletedLeads.length,
          deletedLeads,
        });
      } catch (error: any) {
        fastify.log.error(`Error bulk deleting leads: ${error.message}`);

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
          message: 'Failed to delete leads',
          error: error.message,
        });
      }
    },
  });

  // Generate vendor fit report route
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/:id/vendor-fit`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: Type.Object({
        id: Type.String({ description: 'Lead ID' }),
      }),
      tags: ['Leads'],
      summary: 'Generate Vendor Fit Report',
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
      params: Type.Object({
        id: Type.String({ description: 'Lead ID' }),
      }),
      tags: ['Leads'],
      summary: 'Resync Lead',
      description: 'Resync a lead by ID (tenant-scoped)',
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          message: Type.String(),
          leadId: Type.String(),
        }),
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
        const authenticatedRequest = request as AuthenticatedRequest;
        const { id } = request.params;

        if (!id || !id.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid ID',
          });
          return;
        }

        // analyze lead
        await LeadAnalyzerService.analyzeLead(authenticatedRequest.tenantId, id);

        reply.status(200).send({
          message: 'Lead resync initiated successfully',
          leadId: id,
        });
      } catch (error: any) {
        fastify.log.error(`Error resyncing lead: ${error.message}`);

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
          message: 'Failed to resync lead',
          error: error.message,
        });
      }
    },
  });
}
