import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import {
  getContactById,
  updateContact,
  createContact,
  deleteContact,
  toggleContactManuallyReviewed,
} from '../modules/contact.service';
import { AuthenticatedRequest } from '../plugins/authentication.plugin';

const basePath = '/leads/:leadId/contacts';

// Schema for point of contact
const pointOfContactSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Contact name' }),
  email: Type.String({ format: 'email', description: 'Contact email address' }),
  phone: Type.Optional(Type.String({ description: 'Contact phone number' })),
  title: Type.Optional(Type.String({ description: 'Contact job title' })),
  company: Type.Optional(Type.String({ description: 'Contact company' })),
});

// Schema for point of contact update (all fields optional except validation constraints)
const pointOfContactUpdateSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, description: 'Contact name' })),
  email: Type.Optional(Type.String({ format: 'email', description: 'Contact email address' })),
  phone: Type.Optional(
    Type.Union([Type.String({ description: 'Contact phone number' }), Type.Null()])
  ),
  title: Type.Optional(
    Type.Union([Type.String({ description: 'Contact job title' }), Type.Null()])
  ),
  company: Type.Optional(
    Type.Union([Type.String({ description: 'Contact company' }), Type.Null()])
  ),
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

export default async function contactRoutes(fastify: FastifyInstance) {
  // Get a contact by ID
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/:contactId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Get a contact by ID',
      tags: ['Contacts'],
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID' }),
        contactId: Type.String({ description: 'Contact ID' }),
      }),
      response: {
        200: Type.Object({
          contact: pointOfContactResponseSchema,
        }),
        ...defaultRouteResponse,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
          contactId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId, contactId } = request.params;

        if (!leadId || !leadId.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid lead ID',
          });
          return;
        }

        if (!contactId || !contactId.trim()) {
          reply.status(400).send({
            message: 'Contact ID is required',
            error: 'Invalid contact ID',
          });
          return;
        }

        const contact = await getContactById(authenticatedRequest.tenantId, leadId, contactId);

        if (!contact) {
          reply.status(404).send({
            message: 'Contact not found',
            error: `Contact with ID ${contactId} not found for lead ${leadId}`,
          });
          return;
        }

        reply.status(200).send({
          contact,
        });
      } catch (error: any) {
        fastify.log.error(`Error getting contact: ${error.message}`);

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

        reply.status(500).send({
          message: 'Failed to get contact',
          error: error.message,
        });
      }
    },
  });

  // Update a contact
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:contactId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Update a contact',
      tags: ['Contacts'],
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID' }),
        contactId: Type.String({ description: 'Contact ID' }),
      }),
      body: pointOfContactUpdateSchema,
      response: {
        200: Type.Object({
          message: Type.String(),
          contact: pointOfContactResponseSchema,
        }),
        ...defaultRouteResponse,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
          contactId: string;
        };
        Body: {
          name?: string;
          email?: string;
          phone?: string | null;
          title?: string | null;
          company?: string | null;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId, contactId } = request.params;
        const contactData = request.body;

        if (!leadId || !leadId.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid lead ID',
          });
          return;
        }

        if (!contactId || !contactId.trim()) {
          reply.status(400).send({
            message: 'Contact ID is required',
            error: 'Invalid contact ID',
          });
          return;
        }

        // Check if at least one field is provided for update
        if (Object.keys(contactData).length === 0) {
          reply.status(400).send({
            message: 'At least one field must be provided for update',
            error: 'No update data provided',
          });
          return;
        }

        const updatedContact = await updateContact(
          authenticatedRequest.tenantId,
          leadId,
          contactId,
          contactData
        );

        fastify.log.info(
          `Contact updated. Contact ID: ${contactId}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact updated successfully',
          contact: updatedContact,
        });
      } catch (error: any) {
        fastify.log.error(`Error updating contact: ${error.message}`);

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

        if (
          error.message?.includes('Lead not found') ||
          error.message?.includes('Contact not found')
        ) {
          reply.status(404).send({
            message: 'Lead or contact not found',
            error: error.message,
          });
          return;
        }

        if (error.message?.includes('required') || error.message?.includes('Invalid email')) {
          reply.status(400).send({
            message: 'Validation error',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to update contact',
          error: error.message,
        });
      }
    },
  });

  // Create a contact
  fastify.route({
    method: HttpMethods.POST,
    url: basePath,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Create a new contact for a lead',
      tags: ['Contacts'],
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID' }),
      }),
      body: pointOfContactSchema,
      response: {
        201: Type.Object({
          message: Type.String(),
          contact: pointOfContactResponseSchema,
        }),
        ...defaultRouteResponse,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
        };
        Body: {
          name: string;
          email: string;
          phone?: string;
          title?: string;
          company?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId } = request.params;
        const contactData = request.body;

        if (!leadId || !leadId.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid lead ID',
          });
          return;
        }

        const createdContact = await createContact(
          authenticatedRequest.tenantId,
          leadId,
          contactData
        );

        fastify.log.info(
          `Contact created. Contact ID: ${createdContact.id}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(201).send({
          message: 'Contact created successfully',
          contact: createdContact,
        });
      } catch (error: any) {
        fastify.log.error(`Error creating contact: ${error.message}`);

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

        if (error.message?.includes('required') || error.message?.includes('Invalid email')) {
          reply.status(400).send({
            message: 'Validation error',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to create contact',
          error: error.message,
        });
      }
    },
  });

  // Delete a contact
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/:contactId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Delete a contact',
      tags: ['Contacts'],
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID' }),
        contactId: Type.String({ description: 'Contact ID' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        ...defaultRouteResponse,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
          contactId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId, contactId } = request.params;

        if (!leadId || !leadId.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid lead ID',
          });
          return;
        }

        if (!contactId || !contactId.trim()) {
          reply.status(400).send({
            message: 'Contact ID is required',
            error: 'Invalid contact ID',
          });
          return;
        }

        await deleteContact(authenticatedRequest.tenantId, leadId, contactId);

        fastify.log.info(
          `Contact deleted. Contact ID: ${contactId}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact deleted successfully',
        });
      } catch (error: any) {
        fastify.log.error(`Error deleting contact: ${error.message}`);

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

        if (
          error.message?.includes('Lead not found') ||
          error.message?.includes('Contact not found')
        ) {
          reply.status(404).send({
            message: 'Lead or contact not found',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to delete contact',
          error: error.message,
        });
      }
    },
  });

  // Toggle contact manually reviewed status
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:contactId/manually-reviewed`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Toggle contact manually reviewed status',
      tags: ['Contacts'],
      params: Type.Object({
        leadId: Type.String({ description: 'Lead ID' }),
        contactId: Type.String({ description: 'Contact ID' }),
      }),
      body: Type.Object({
        manuallyReviewed: Type.Boolean({ description: 'Manually reviewed status' }),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
          contact: pointOfContactResponseSchema,
        }),
        ...defaultRouteResponse,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          leadId: string;
          contactId: string;
        };
        Body: {
          manuallyReviewed: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { leadId, contactId } = request.params;
        const { manuallyReviewed } = request.body;

        if (!leadId || !leadId.trim()) {
          reply.status(400).send({
            message: 'Lead ID is required',
            error: 'Invalid lead ID',
          });
          return;
        }

        if (!contactId || !contactId.trim()) {
          reply.status(400).send({
            message: 'Contact ID is required',
            error: 'Invalid contact ID',
          });
          return;
        }

        const updatedContact = await toggleContactManuallyReviewed(
          authenticatedRequest.tenantId,
          leadId,
          contactId,
          manuallyReviewed
        );

        fastify.log.info(
          `Contact manually reviewed status updated. Contact ID: ${contactId}, Lead ID: ${leadId}, Status: ${manuallyReviewed}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact manually reviewed status updated successfully',
          contact: updatedContact,
        });
      } catch (error: any) {
        fastify.log.error(`Error updating contact manually reviewed status: ${error.message}`);

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

        if (
          error.message?.includes('Lead not found') ||
          error.message?.includes('Contact not found')
        ) {
          reply.status(404).send({
            message: 'Lead or contact not found',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to update contact manually reviewed status',
          error: error.message,
        });
      }
    },
  });
}
