import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { createContact } from '@/modules/contact.service';
import { createLead } from '@/modules/lead.service';
import { ContactCampaignPlanService } from '@/modules/campaign/contactCampaignPlan.service';
import { repositories } from '@/repositories';
import { logger } from '@/libs/logger';
import { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import { BulkContactsCreateSchema } from './apiSchema/bulkContacts/bulkContacts.schema';

const basePath = '/bulk-contacts';

interface BulkContactsRequest {
  Body: {
    emails: string;
    leadName: string;
    tenantId: string;
    body: string;
    ownerId: string;
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
        const { emails, leadName, tenantId, body, ownerId } = request.body;

        logger.info('Processing bulk contacts creation', {
          tenantId,
          leadName,
          emailCount: emails.split(',').length,
        });

        // Create a new lead
        const lead = await createLead(
          tenantId,
          {
            name: leadName,
            url: `https://example.com/${leadName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          },
          ownerId
        );

        logger.info('Created new lead for bulk contacts', {
          leadId: lead.id,
          leadName,
          tenantId,
          ownerId,
        });

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
            const name = email.split('@')[0]!;

            // Create contact
            const contact = await createContact(tenantId, lead.id, {
              name,
              email,
            });

            createdContacts.push(contact);

            // Create a basic campaign plan
            const campaignPlan = {
              version: '1.0',
              timezone: 'America/Chicago',
              quietHours: { start: '20:00', end: '08:00' },
              defaults: {
                timers: {
                  no_open_after: 'PT72H',
                  no_click_after: 'PT24H',
                },
              },
              startNodeId: 'single_email',
              nodes: [
                {
                  id: 'single_email',
                  channel: 'email',
                  action: 'send',
                  subject: `Quick question about depositions at ${leadName}`,
                  body: `Hi ${body}`,
                  schedule: { delay: 'PT0S' },
                  transitions: [],
                },
              ],
            } as CampaignPlanOutput;
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
