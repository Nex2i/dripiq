import { logger } from '@/libs/logger';
import {
  leadRepository,
  contactCampaignRepository,
  leadPointOfContactRepository,
} from '@/repositories';
import { generateContactStrategy } from '@/modules/ai';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import { contactCampaignPlanService } from './contactCampaignPlan.service';
import { campaignPlanExecutionService } from './campaignPlanExecution.service';

export interface CampaignStartResult {
  contactId: string;
  contactName: string;
  status: 'started' | 'skipped' | 'failed';
  reason?: string;
  campaignId?: string;
}

export interface LeadCampaignStartResults {
  total: number;
  started: number;
  skipped: number;
  failed: number;
  details: CampaignStartResult[];
}

/**
 * Service responsible for starting campaigns for all contacts in a lead
 */
export class LeadCampaignStartService {
  /**
   * Starts campaigns for all contacts in a lead that don't already have active campaigns
   */
  async startCampaignsForLead(
    tenantId: string,
    leadId: string,
    userId?: string
  ): Promise<LeadCampaignStartResults> {
    try {
      logger.info('Starting campaigns for lead', { tenantId, leadId, userId });

      // Verify lead exists and get lead data
      const lead = await leadRepository.findByIdForTenant(leadId, tenantId);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      // Get all contacts for the lead
      const contacts = await leadPointOfContactRepository.findByLeadIdForTenant(leadId, tenantId);

      if (!contacts || contacts.length === 0) {
        logger.info('No contacts found for lead', { tenantId, leadId });
        return {
          total: 0,
          started: 0,
          skipped: 0,
          failed: 0,
          details: [],
        };
      }

      logger.info(`Found ${contacts.length} contacts for lead`, { tenantId, leadId });

      const results: CampaignStartResult[] = [];
      let started = 0;
      let skipped = 0;
      let failed = 0;

      // Process each contact
      for (const contact of contacts) {
        try {
          logger.info('Processing contact for campaign start', {
            tenantId,
            leadId,
            contactId: contact.id,
            contactName: contact.name,
          });

          // Check if contact already has a campaign
          const existingCampaign = await contactCampaignRepository.findByContactAndChannelForTenant(
            tenantId,
            contact.id,
            'email'
          );

          // Skip if contact already has an active or completed campaign
          if (
            existingCampaign &&
            ['active', 'completed', 'paused'].includes(existingCampaign.status)
          ) {
            logger.info('Contact already has active/completed campaign, skipping', {
              tenantId,
              leadId,
              contactId: contact.id,
              campaignId: existingCampaign.id,
              status: existingCampaign.status,
            });

            results.push({
              contactId: contact.id,
              contactName: contact.name,
              status: 'skipped',
              reason: `Already has ${existingCampaign.status} campaign`,
              campaignId: existingCampaign.id,
            });
            skipped++;
            continue;
          }

          // Handle draft campaigns or create new ones
          let campaignResult: { campaignId: string };

          if (existingCampaign && existingCampaign.status === 'draft') {
            // Start existing draft campaign
            campaignResult = await this.startDraftCampaign(
              tenantId,
              leadId,
              contact.id,
              existingCampaign
            );
          } else {
            // Generate new contact strategy and start campaign
            campaignResult = await this.startCampaignForContact(
              tenantId,
              leadId,
              contact.id,
              userId
            );
          }

          results.push({
            contactId: contact.id,
            contactName: contact.name,
            status: 'started',
            campaignId: campaignResult.campaignId,
          });
          started++;

          logger.info('Campaign started successfully for contact', {
            tenantId,
            leadId,
            contactId: contact.id,
            campaignId: campaignResult.campaignId,
          });
        } catch (error) {
          logger.error('Failed to start campaign for contact', {
            tenantId,
            leadId,
            contactId: contact.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          results.push({
            contactId: contact.id,
            contactName: contact.name,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
          failed++;
        }
      }

      const finalResults: LeadCampaignStartResults = {
        total: contacts.length,
        started,
        skipped,
        failed,
        details: results,
      };

      logger.info('Campaign start process completed for lead', {
        tenantId,
        leadId,
        results: finalResults,
      });

      return finalResults;
    } catch (error) {
      logger.error('Failed to start campaigns for lead', {
        tenantId,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Starts a draft campaign that already exists
   */
  private async startDraftCampaign(
    tenantId: string,
    leadId: string,
    contactId: string,
    existingCampaign: any
  ): Promise<{ campaignId: string }> {
    try {
      logger.info('Starting existing draft campaign', {
        tenantId,
        leadId,
        contactId,
        campaignId: existingCampaign.id,
      });

      if (!existingCampaign.planJson) {
        throw new Error('Draft campaign missing plan JSON');
      }

      const campaignPlan = existingCampaign.planJson as CampaignPlanOutput;

      // Initialize campaign execution
      await campaignPlanExecutionService.initializeCampaignExecution({
        tenantId,
        campaignId: existingCampaign.id,
        contactId,
        plan: campaignPlan,
      });

      logger.info('Draft campaign execution initialized', {
        tenantId,
        leadId,
        contactId,
        campaignId: existingCampaign.id,
      });

      return { campaignId: existingCampaign.id };
    } catch (error) {
      logger.error('Failed to start draft campaign', {
        tenantId,
        leadId,
        contactId,
        campaignId: existingCampaign.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Starts a campaign for a specific contact by generating a new strategy
   */
  private async startCampaignForContact(
    tenantId: string,
    leadId: string,
    contactId: string,
    userId?: string
  ): Promise<{ campaignId: string }> {
    try {
      // Generate contact strategy
      const strategyResult = await generateContactStrategy({
        leadId,
        contactId,
        tenantId,
        userId,
      });

      const campaignPlan = strategyResult.finalResponseParsed as CampaignPlanOutput;

      // Persist the campaign plan
      const persistResult = await contactCampaignPlanService.persistPlan({
        tenantId,
        leadId,
        contactId,
        userId,
        plan: campaignPlan,
        channel: 'email',
      });

      // Initialize campaign execution
      await campaignPlanExecutionService.initializeCampaignExecution({
        tenantId,
        campaignId: persistResult.campaignId,
        contactId,
        plan: campaignPlan,
      });

      logger.info('New campaign execution initialized', {
        tenantId,
        leadId,
        contactId,
        campaignId: persistResult.campaignId,
      });

      return { campaignId: persistResult.campaignId };
    } catch (error) {
      logger.error('Failed to start new campaign for contact', {
        tenantId,
        leadId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const leadCampaignStartService = new LeadCampaignStartService();
