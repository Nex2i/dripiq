import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import { processBulkCampaign, BulkCampaignRequest } from '../modules/bulkCampaign.service';
import { BulkCampaignCreateSchema } from './apiSchema/bulkCampaign';

const basePath = '/bulk-campaign';

export default async function bulkCampaignRoutes(fastify: FastifyInstance) {
  // Create bulk campaign route
  fastify.route({
    method: HttpMethods.POST,
    url: basePath,
    schema: {
      description: 'Create a lead with contacts and campaigns from comma-separated emails',
      tags: ['Bulk Campaign'],
      ...BulkCampaignCreateSchema,
      response: {
        ...defaultRouteResponse,
        ...BulkCampaignCreateSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: BulkCampaignRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { emails, leadName, tenantId, body } = request.body;

        logger.info('Processing bulk campaign request', {
          leadName,
          tenantId,
          emailCount: emails.split(',').length,
          ip: request.ip,
        });

        // Validate that tenantId is provided
        if (!tenantId || !tenantId.trim()) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Tenant ID is required',
          });
        }

        // Validate that leadName is provided
        if (!leadName || !leadName.trim()) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Lead name is required',
          });
        }

        // Validate that emails are provided
        if (!emails || !emails.trim()) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Emails are required',
          });
        }

        // Validate that body is provided
        if (!body || !body.trim()) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Campaign body is required',
          });
        }

        // Process the bulk campaign
        const result = await processBulkCampaign({
          emails,
          leadName,
          tenantId,
          body,
        });

        logger.info('Bulk campaign processing completed', {
          leadId: result.leadId,
          leadName: result.leadName,
          tenantId: result.tenantId,
          totalEmails: result.totalEmails,
          successfulContacts: result.successfulContacts,
          successfulCampaigns: result.successfulCampaigns,
        });

        return reply.status(201).send({
          message: 'Bulk campaign created successfully',
          ...result,
        });
      } catch (error) {
        logger.error('Error processing bulk campaign request:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          body: request.body,
        });

        // Handle specific error types
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({
              error: 'Not Found',
              message: error.message,
            });
          }

          if (
            error.message.includes('Tenant ID') ||
            error.message.includes('invalid') ||
            error.message.includes('required')
          ) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: error.message,
            });
          }

          if (error.message.includes('verified sender identity')) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: 'Cannot create lead: no verified sender identity found for tenant',
            });
          }
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An error occurred while processing the bulk campaign',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}
