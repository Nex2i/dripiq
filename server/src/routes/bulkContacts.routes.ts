import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createId } from '@paralleldrive/cuid2';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { createContact } from '@/modules/contact.service';
import { ContactCampaignPlanService } from '@/modules/campaign/contactCampaignPlan.service';
import { leadRepository } from '@/repositories';
import { logger } from '@/libs/logger';
import { BulkContactsCreateSchema } from './apiSchema/bulkContacts/bulkContacts.schema';

const basePath = '/bulk-contacts';

interface BulkContactsRequest {
  Body: {
    emails: string;
    leadName: string;
    tenantId: string;
    body: string;
  };
  Headers: {
    'x-api-key': string;
  };
}

export default async function bulkContactsRoutes(fastify: FastifyInstance) {
  // Create bulk contacts and campaigns
  fastify.route({
    method: HttpMethods.POST,
    url: basePath,
    schema: {
      description:
        'Create multiple contacts and auto-generate campaigns from comma-separated emails',
      tags: ['Bulk Operations'],
      ...BulkContactsCreateSchema,
      response: {
        ...defaultRouteResponse,
        ...BulkContactsCreateSchema.response,
      },
    },
    handler: async (request: FastifyRequest<BulkContactsRequest>, reply: FastifyReply) => {
      try {
        const { emails, leadName, tenantId, body } = request.body;

        logger.info('Processing bulk contacts creation', {
          tenantId,
          leadName,
          emailCount: emails.split(',').length,
        });

        // Find the lead by name and tenant
        const lead = await leadRepository.findByNameAndTenant(leadName, tenantId);
        if (!lead) {
          logger.warn('Lead not found for bulk contacts creation', {
            leadName,
            tenantId,
          });
          return reply.status(404).send({
            error: 'Not Found',
            message: `Lead with name "${leadName}" not found`,
          });
        }

        // Parse and validate emails
        const emailList = emails
          .split(',')
          .map((email) => email.trim())
          .filter((email) => email.length > 0);

        if (emailList.length === 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No valid emails provided',
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emailList.filter((email) => !emailRegex.test(email));
        if (invalidEmails.length > 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid email format: ${invalidEmails.join(', ')}`,
          });
        }

        const createdContacts = [];
        const createdCampaigns = [];
        const campaignService = new ContactCampaignPlanService();

        // Create contacts and campaigns for each email
        for (const email of emailList) {
          try {
            // Extract name from email (text before @)
            const name = email.split('@')[0];

            // Create contact
            const contact = await createContact(tenantId, lead.id, {
              name,
              email,
              leadId: lead.id,
            });

            createdContacts.push(contact);

            // Create a basic campaign plan
            const campaignPlan = {
              startNodeId: createId(),
              nodes: [
                {
                  id: createId(),
                  type: 'email' as const,
                  subject: 'test',
                  content: body,
                  timing: {
                    type: 'immediate' as const,
                  },
                  nextNodes: [],
                },
              ],
            };

            // Create campaign
            const campaignResult = await campaignService.persistPlan({
              tenantId,
              leadId: lead.id,
              contactId: contact.id,
              plan: campaignPlan,
              channel: 'email',
            });

            createdCampaigns.push({
              id: campaignResult.campaignId,
              contactId: contact.id,
              status: 'draft',
              channel: 'email',
            });

            logger.info('Created contact and campaign', {
              contactId: contact.id,
              campaignId: campaignResult.campaignId,
              email,
              tenantId,
            });
          } catch (error) {
            logger.error('Error creating contact or campaign', {
              email,
              error: error instanceof Error ? error.message : String(error),
              tenantId,
              leadId: lead.id,
            });
            // Continue with other emails even if one fails
          }
        }

        const response = {
          success: true,
          data: {
            contactsCreated: createdContacts.length,
            campaignsCreated: createdCampaigns.length,
            contacts: createdContacts.map((contact) => ({
              id: contact.id,
              name: contact.name,
              email: contact.email || '',
              leadId: contact.leadId,
            })),
            campaigns: createdCampaigns,
          },
        };

        logger.info('Bulk contacts creation completed', {
          tenantId,
          leadName,
          contactsCreated: createdContacts.length,
          campaignsCreated: createdCampaigns.length,
        });

        return reply.status(200).send(response);
      } catch (error) {
        logger.error('Error in bulk contacts creation:', error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create contacts and campaigns',
        });
      }
    },
  });
}
