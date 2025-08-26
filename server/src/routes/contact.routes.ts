import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import {
  getContactById,
  updateContact,
  createContact,
  deleteContact,
  toggleContactManuallyReviewed,
  unsubscribeContact,
} from '../modules/contact.service';
import { AuthenticatedRequest } from '../plugins/authentication.plugin';
import {
  ContactCreateSchema,
  ContactGetSchema,
  ContactUpdateSchema,
  ContactDeleteSchema,
  ContactManualReviewSchema,
  ContactUnsubscribeSchema,
} from './apiSchema/contact';

const basePath = '/leads/:leadId/contacts';

export default async function contactRoutes(fastify: FastifyInstance) {
  // Get a contact by ID
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/:contactId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Get a contact by ID',
      tags: ['Contacts'],
      ...ContactGetSchema,
      response: {
        ...defaultRouteResponse,
        ...ContactGetSchema.response,
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
        logger.error(`Error getting contact: ${error.message}`);

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
      ...ContactUpdateSchema,
      response: {
        ...defaultRouteResponse,
        ...ContactUpdateSchema.response,
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

        logger.info(
          `Contact updated. Contact ID: ${contactId}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact updated successfully',
          contact: updatedContact,
        });
      } catch (error: any) {
        logger.error(`Error updating contact: ${error.message}`);

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
      ...ContactCreateSchema,
      response: {
        ...defaultRouteResponse,
        ...ContactCreateSchema.response,
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

        logger.info(
          `Contact created. Contact ID: ${createdContact.id}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(201).send({
          message: 'Contact created successfully',
          contact: createdContact,
        });
      } catch (error: any) {
        logger.error(`Error creating contact: ${error.message}`);

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
      ...ContactDeleteSchema,
      response: {
        ...defaultRouteResponse,
        ...ContactDeleteSchema.response,
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

        logger.info(
          `Contact deleted. Contact ID: ${contactId}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact deleted successfully',
        });
      } catch (error: any) {
        logger.error(`Error deleting contact: ${error.message}`);

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
      ...ContactManualReviewSchema,
      response: {
        ...defaultRouteResponse,
        ...ContactManualReviewSchema.response,
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

        logger.info(
          `Contact manually reviewed status updated. Contact ID: ${contactId}, Lead ID: ${leadId}, Status: ${manuallyReviewed}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact manually reviewed status updated successfully',
          contact: updatedContact,
        });
      } catch (error: any) {
        logger.error(`Error updating contact manually reviewed status: ${error.message}`);

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

  // Unsubscribe a contact
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/:contactId/unsubscribe`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description: 'Unsubscribe a contact from email communications',
      tags: ['Contacts'],
      ...ContactUnsubscribeSchema,
      response: {
        ...defaultRouteResponse,
        ...ContactUnsubscribeSchema.response,
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

        const unsubscribed = await unsubscribeContact(
          authenticatedRequest.tenantId,
          leadId,
          contactId
        );

        logger.info(
          `Contact unsubscribed. Contact ID: ${contactId}, Lead ID: ${leadId}, Tenant: ${authenticatedRequest.tenantId}`
        );

        reply.status(200).send({
          message: 'Contact unsubscribed successfully',
          unsubscribed,
        });
      } catch (error: any) {
        logger.error(`Error unsubscribing contact: ${error.message}`);

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

        if (error.message?.includes('must have an email')) {
          reply.status(400).send({
            message: 'Contact cannot be unsubscribed',
            error: error.message,
          });
          return;
        }

        reply.status(500).send({
          message: 'Failed to unsubscribe contact',
          error: error.message,
        });
      }
    },
  });
}
