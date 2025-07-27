import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { LeadAnalyzerService } from '@/modules/ai/leadAnalyzer.service';
import { defaultRouteResponse } from '@/types/response';
import { LeadVendorFitService } from '@/modules/ai/leadVendorFit.service';
import { qualifyLeadContact } from '@/modules/ai';
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
  sourceUrl: Type.Optional(Type.String({ description: 'URL where contact information was found' })),
  manuallyReviewed: Type.Boolean({ description: 'Whether the contact has been manually reviewed' }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

// Schema for lead status response
const leadStatusResponseSchema = Type.Object({
  id: Type.String({ description: 'Status ID' }),
  status: Type.String({
    enum: [
      'Unprocessed',
      'Syncing Site',
      'Scraping Site',
      'Analyzing Site',
      'Extracting Contacts',
      'Processed',
    ],
    description: 'Status value',
  }),
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
  ownerId: Type.Optional(Type.String({ description: 'Lead owner ID' })),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  pointOfContacts: Type.Optional(
    Type.Array(pointOfContactResponseSchema, {
      description: 'Array of point of contacts for the lead',
    })
  ),
  statuses: Type.Optional(
    Type.Array(leadStatusResponseSchema, {
      description: 'Array of processing statuses for the lead',
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
        await LeadAnalyzerService.indexSite(authenticatedRequest.tenantId, id);

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

  // Assign lead owner route
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:id/assign-owner`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: Type.Object({
        id: Type.String({ description: 'Lead ID' }),
      }),
      body: Type.Object({
        userId: Type.String({ description: 'User ID to assign as owner' }),
      }),
      tags: ['Leads'],
      summary: 'Assign Lead Owner',
      description: 'Assign a user as the owner of a lead (tenant-scoped)',
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

        reply.status(500).send({
          message: 'Failed to assign lead owner',
          error: error.message,
        });
      }
    },
  });

  // Lead qualification endpoint
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:leadId/contacts/:contactId/qualification`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Generate lead qualification and outreach strategy for a specific contact',
      tags: ['Leads'],
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID' }),
        contactId: Type.String({ description: 'Contact ID' }),
      }),

      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
          data: Type.Any(), // Simplified schema - using Any for complex nested structure
          metadata: Type.Object({
            totalIterations: Type.Number(),
            processingTime: Type.Number(),
          }),
        }),
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const { leadId, contactId } = request.params as { leadId: string; contactId: string };
      const userId = user?.id;

      try {
        const startTime = Date.now();

        const result = await qualifyLeadContact({
          leadId,
          contactId,
          tenantId,
          userId,
        });

        const processingTime = Date.now() - startTime;

        reply.status(200).send({
          success: true,
          message: 'Lead qualification completed successfully',
          data: result.finalResponseParsed,
          metadata: {
            totalIterations: result.totalIterations,
            processingTime,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error qualifying lead contact: ${error.message}`);

        if (error.message?.includes('Access denied')) {
          reply.status(403).send({
            success: false,
            message: 'Access denied to tenant resources',
            error: error.message,
          });
          return;
        }

        if (error.message?.includes('not found') || error.message?.includes('Contact not found')) {
          reply.status(404).send({
            success: false,
            message: 'Lead or contact not found',
            error: error.message,
          });
          return;
        }

        if (error.message?.includes('No contacts found')) {
          reply.status(400).send({
            success: false,
            message: 'No contacts available for this lead',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          success: false,
          message: 'Failed to generate lead qualification',
          error: error.message,
        });
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
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID to get products for' }),
      }),
      response: {
        ...defaultRouteResponse(),
        200: Type.Array(
          Type.Object({
            id: Type.String({ description: 'Lead-Product attachment ID' }),
            leadId: Type.String({ description: 'Lead ID' }),
            productId: Type.String({ description: 'Product ID' }),
            attachedAt: Type.String({
              format: 'date-time',
              description: 'When the product was attached',
            }),
            createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
            updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
            product: Type.Object({
              id: Type.String({ description: 'Product ID' }),
              title: Type.String({ description: 'Product title' }),
              description: Type.Optional(Type.String({ description: 'Product description' })),
              salesVoice: Type.Optional(Type.String({ description: 'Product sales voice' })),
              tenantId: Type.String({ description: 'Tenant ID' }),
              createdAt: Type.String({
                format: 'date-time',
                description: 'Product created timestamp',
              }),
              updatedAt: Type.String({
                format: 'date-time',
                description: 'Product updated timestamp',
              }),
            }),
          }),
          { description: 'List of products attached to the lead' }
        ),
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
    method: [HttpMethods.POST, HttpMethods.OPTIONS],
    url: `${basePath}/:leadId/products`,
    schema: {
      tags: ['Lead Products'],
      summary: 'Attach Products to Lead',
      description: 'Attach one or more products to a lead (tenant-scoped)',
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID to attach products to' }),
      }),
      body: Type.Object({
        productIds: Type.Array(Type.String(), {
          description: 'Array of product IDs to attach to the lead',
          minItems: 1,
        }),
      }),
      response: {
        ...defaultRouteResponse(),
        201: Type.Object({
          success: Type.Boolean({ description: 'Whether the operation was successful' }),
          message: Type.String({ description: 'Success message' }),
          attachedCount: Type.Number({ description: 'Number of products attached' }),
          attachments: Type.Array(
            Type.Object({
              id: Type.String({ description: 'Attachment ID' }),
              leadId: Type.String({ description: 'Lead ID' }),
              productId: Type.String({ description: 'Product ID' }),
              attachedAt: Type.String({
                format: 'date-time',
                description: 'When the product was attached',
              }),
              createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
              updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
            }),
            { description: 'List of created attachments' }
          ),
        }),
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

        fastify.log.info(
          `Attaching ${productIds.length} products to lead: ${leadId} for tenant: ${authenticatedRequest.tenantId}`
        );

        const attachments = await attachProductsToLead(
          leadId,
          productIds,
          authenticatedRequest.tenantId
        );

        fastify.log.info(`Successfully attached ${attachments.length} products to lead: ${leadId}`);

        reply.status(201).send({
          success: true,
          message: `Successfully attached ${attachments.length} product(s) to lead`,
          attachedCount: attachments.length,
          attachments,
        });
      } catch (error: any) {
        fastify.log.error(`Error attaching products to lead: ${error.message}`);

        if (error.message?.includes('not found') || error.message?.includes('access denied')) {
          reply.status(404).send({
            success: false,
            message: 'Lead not found or access denied',
            error: error.message,
          });
          return;
        }

        if (
          error.message?.includes('Invalid product IDs') ||
          error.message?.includes('already attached')
        ) {
          reply.status(400).send({
            success: false,
            message: error.message,
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          success: false,
          message: 'Failed to attach products to lead',
          error: error.message,
        });
      }
    },
  });

  // Detach product from lead route
  fastify.route({
    method: [HttpMethods.DELETE, HttpMethods.OPTIONS],
    url: `${basePath}/:leadId/products/:productId`,
    schema: {
      tags: ['Lead Products'],
      summary: 'Detach Product from Lead',
      description: 'Detach a specific product from a lead (tenant-scoped)',
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID to detach product from' }),
        productId: Type.String({ description: 'Product ID to detach from the lead' }),
      }),
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          success: Type.Boolean({ description: 'Whether the operation was successful' }),
          message: Type.String({ description: 'Success message' }),
        }),
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

        fastify.log.info(
          `Detaching product ${productId} from lead: ${leadId} for tenant: ${authenticatedRequest.tenantId}`
        );

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

        fastify.log.info(`Successfully detached product ${productId} from lead: ${leadId}`);

        reply.send({
          success: true,
          message: 'Product successfully detached from lead',
        });
      } catch (error: any) {
        fastify.log.error(`Error detaching product from lead: ${error.message}`);

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
          message: 'Failed to detach product from lead',
          error: error.message,
        });
      }
    },
  });
}
