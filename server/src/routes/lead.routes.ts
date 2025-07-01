import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { getLeads, createLead } from '../modules/lead.service';
import { NewLead } from '../db/schema';

const basePath = '/leads';

// Schema for create lead endpoint
const createLeadBodySchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Lead name' }),
  email: Type.String({ format: 'email', description: 'Lead email address' }),
  company: Type.Optional(Type.String({ description: 'Lead company' })),
  phone: Type.Optional(Type.String({ description: 'Lead phone number' })),
  status: Type.Optional(
    Type.String({
      enum: ['new', 'contacted', 'qualified', 'lost'],
      default: 'new',
      description: 'Lead status',
    })
  ),
});

// Schema for lead response
const leadResponseSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
  name: Type.String({ description: 'Lead name' }),
  email: Type.String({ description: 'Lead email' }),
  company: Type.Optional(Type.String({ description: 'Lead company' })),
  phone: Type.Optional(Type.String({ description: 'Lead phone' })),
  status: Type.String({ description: 'Lead status' }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

export default async function LeadRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get all leads route
  fastify.route({
    method: HttpMethods.GET,
    url: basePath,
    schema: {
      tags: ['Leads'],
      summary: 'Get All Leads',
      description: 'Retrieve all leads from the database with optional search',
      querystring: Type.Object({
        search: Type.Optional(Type.String({ description: 'Search term to filter leads' })),
      }),
      response: {
        200: Type.Array(leadResponseSchema, { description: 'List of leads' }),
        500: Type.Object({
          message: Type.String(),
          error: Type.Optional(Type.String()),
        }),
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
        const { search } = request.query;
        const leads = await getLeads(search);

        reply.send(leads);
      } catch (error: any) {
        fastify.log.error(`Error fetching leads: ${error.message}`);
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
    schema: {
      body: createLeadBodySchema,
      tags: ['Leads'],
      summary: 'Create New Lead',
      description: 'Create a new lead in the database',
      response: {
        201: Type.Object({
          message: Type.String(),
          lead: leadResponseSchema,
        }),
        400: Type.Object({
          message: Type.String(),
          error: Type.Optional(Type.String()),
        }),
        500: Type.Object({
          message: Type.String(),
          error: Type.Optional(Type.String()),
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          name: string;
          email: string;
          company?: string;
          phone?: string;
          status?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const leadData = request.body;

        // Validate required fields (additional validation beyond schema)
        if (!leadData.name?.trim()) {
          reply.status(400).send({
            message: 'Lead name is required',
            error: 'Name cannot be empty',
          });
          return;
        }

        if (!leadData.email?.trim()) {
          reply.status(400).send({
            message: 'Lead email is required',
            error: 'Email cannot be empty',
          });
          return;
        }

        // Create the lead
        const newLead = await createLead(leadData as NewLead);

        if (!newLead) {
          fastify.log.error('Lead creation failed - no lead returned from database');
          reply.status(500).send({
            message: 'Failed to create lead',
            error: 'Database operation failed',
          });
          return;
        }

        fastify.log.info(`Lead created successfully with ID: ${newLead.id}`);

        reply.status(201).send({
          message: 'Lead created successfully',
          lead: newLead,
        });
      } catch (error: any) {
        fastify.log.error(`Error creating lead: ${error.message}`);

        // Check for specific database errors
        if (error.message?.includes('duplicate') || error.code === '23505') {
          reply.status(400).send({
            message: 'Lead with this email already exists',
            error: 'Duplicate email address',
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
}
