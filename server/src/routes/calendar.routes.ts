import { FastifyInstance } from 'fastify';
import { logger } from '@/libs/logger';
import {
  calendarLinkClickRepository,
  userRepository,
  leadRepository,
  leadPointOfContactRepository,
  contactCampaignRepository,
} from '@/repositories';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

interface CalendarTrackParams {
  tenantId: string;
  leadId: string;
  contactId: string;
}

interface CalendarTrackQuery {
  campaignId?: string;
  nodeId?: string;
  messageId?: string;
}

export default async function calendarRoutes(fastify: FastifyInstance) {
  // Calendar link click tracking and redirect
  fastify.get<{
    Params: CalendarTrackParams;
    Querystring: CalendarTrackQuery;
  }>('/calendar/track/:tenantId/:leadId/:contactId', async (request, reply) => {
    const { tenantId, leadId, contactId } = request.params;
    const { campaignId, nodeId, messageId } = request.query;

    try {
      // Get request metadata for tracking
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];
      const referrer = request.headers['referer'];

      logger.info('[CalendarRoutes] Calendar link clicked', {
        tenantId,
        leadId,
        contactId,
        campaignId,
        nodeId,
        messageId,
        ipAddress,
        userAgent,
        referrer,
      });

      // Validate that the lead belongs to the tenant and contact belongs to the lead
      const lead = await leadRepository.findByIdForTenant(leadId, tenantId);
      if (!lead) {
        logger.warn('[CalendarRoutes] Lead not found or does not belong to tenant', {
          tenantId,
          leadId,
        });
        return reply.status(404).send({ error: 'Lead not found' });
      }

      const contact = await leadPointOfContactRepository.findByIdForTenant(contactId, tenantId);
      if (!contact || contact.leadId !== leadId) {
        logger.warn('[CalendarRoutes] Contact not found or does not belong to lead', {
          tenantId,
          leadId,
          contactId,
        });
        return reply.status(404).send({ error: 'Contact not found' });
      }

      // Get the user (calendar owner) - assuming the lead owner is the calendar owner
      let userId = lead.ownerId;
      if (!userId) {
        logger.warn('[CalendarRoutes] Lead has no owner, cannot determine calendar owner', {
          tenantId,
          leadId,
        });
        return reply.status(400).send({ error: 'No calendar owner found for this lead' });
      }

      const user = await userRepository.findById(userId);
      if (!user || !user.calendarLink) {
        logger.warn('[CalendarRoutes] User not found or has no calendar link', {
          userId,
          tenantId,
          leadId,
        });
        return reply.status(400).send({ error: 'Calendar link not configured' });
      }

      // Log the click
      const calendarClick = await calendarLinkClickRepository.createForTenant(tenantId, {
        leadId,
        contactId,
        userId,
        campaignId,
        nodeId,
        outboundMessageId: messageId,
        ipAddress,
        userAgent,
        referrer,
      });

      logger.info('[CalendarRoutes] Calendar click logged successfully', {
        tenantId,
        leadId,
        contactId,
        userId,
        calendarLink: user.calendarLink,
        calendarClickId: calendarClick.id,
      });

      // Trigger campaign transition if we have campaign context
      if (campaignId && nodeId) {
        try {
          logger.info('[CalendarRoutes] Triggering campaign transition for calendar click', {
            tenantId,
            campaignId,
            nodeId,
            contactId,
            leadId,
            calendarClickId: calendarClick.id,
          });

          // Get the campaign to access the plan
          const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);

          if (campaign && campaign.planJson && campaign.status === 'active') {
            const campaignPlan = campaign.planJson as CampaignPlanOutput;

            // Trigger campaign transition with click event
            await campaignPlanExecutionService.processTransition({
              tenantId,
              campaignId,
              contactId,
              leadId,
              eventType: 'click',
              currentNodeId: nodeId,
              plan: campaignPlan,
              eventRef: calendarClick.id,
            });

            logger.info('[CalendarRoutes] Campaign transition triggered successfully', {
              tenantId,
              campaignId,
              nodeId,
              contactId,
              leadId,
              calendarClickId: calendarClick.id,
            });
          } else {
            logger.debug('[CalendarRoutes] Skipping campaign transition - campaign not found or not active', {
              tenantId,
              campaignId,
              campaignExists: !!campaign,
              campaignStatus: campaign?.status,
              hasPlan: !!campaign?.planJson,
            });
          }
        } catch (transitionError) {
          // Log the error but don't fail the calendar redirect
          logger.error('[CalendarRoutes] Failed to trigger campaign transition for calendar click', {
            tenantId,
            campaignId,
            nodeId,
            contactId,
            leadId,
            calendarClickId: calendarClick.id,
            error: transitionError instanceof Error ? transitionError.message : 'Unknown error',
            stack: transitionError instanceof Error ? transitionError.stack : undefined,
          });
        }
      } else {
        logger.debug('[CalendarRoutes] No campaign context for transition', {
          tenantId,
          leadId,
          contactId,
          hasCampaignId: !!campaignId,
          hasNodeId: !!nodeId,
        });
      }

      // Redirect to the actual calendar link
      return reply.status(302).redirect(user.calendarLink);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[CalendarRoutes] Error processing calendar link click', {
        tenantId,
        leadId,
        contactId,
        campaignId,
        nodeId,
        messageId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Still redirect to avoid breaking user experience, but without logging
      try {
        const lead = await leadRepository.findByIdForTenant(leadId, tenantId);
        if (lead?.ownerId) {
          const user = await userRepository.findById(lead.ownerId);
          if (user?.calendarLink) {
            logger.info('[CalendarRoutes] Redirecting despite error', {
              tenantId,
              leadId,
              calendarLink: user.calendarLink,
            });
            return reply.status(302).redirect(user.calendarLink);
          }
        }
      } catch (fallbackError) {
        logger.error('[CalendarRoutes] Fallback redirect also failed', {
          tenantId,
          leadId,
          contactId,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        });
      }

      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
