import { logger } from '@/libs/logger';
import { contactCampaignRepository, campaignPlanVersionRepository } from '@/repositories';
import type { ContactStrategyResult } from './langchain/agents/ContactStrategyAgent';
import { createContactStrategyAgent, defaultLangChainConfig } from './langchain';
import { contactCampaignPlanService } from '../campaign/contactCampaignPlan.service';

export interface GenerateContactStrategyParams {
  leadId: string;
  contactId: string;
  tenantId: string;
  userId?: string;
}

/**
 * Service to generate contact strategy and outreach plan for a specific contact
 */
export const generateContactStrategy = async (
  params: GenerateContactStrategyParams
): Promise<ContactStrategyResult> => {
  const { leadId, contactId, tenantId, userId } = params;

  try {
    // Check if contact strategy exists in database
    const existingStrategy = await retrieveContactStrategyFromDatabase(params);
    if (existingStrategy) {
      logger.info('Found existing contact strategy in database, returning live data', {
        leadId,
        contactId,
        tenantId,
      });
      return existingStrategy;
    }

    // Execute agent analysis
    try {
      const agent = createContactStrategyAgent({ ...defaultLangChainConfig });
      const result = await agent.generateContactStrategy(tenantId, leadId, contactId);

      // Persist the parsed plan into campaign tables (idempotent)
      try {
        await contactCampaignPlanService.persistPlan({
          tenantId,
          leadId,
          contactId,
          userId,
          plan: result.finalResponseParsed,
          channel: 'email',
        });
      } catch (dbError) {
        logger.error('Failed to persist campaign plan to database', {
          tenantId,
          leadId,
          contactId,
          error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
        });
        throw dbError;
      }

      return result;
    } catch (agentError) {
      logger.error('Agent execution failed', {
        leadId,
        contactId,
        tenantId,
        error: agentError instanceof Error ? agentError.message : 'Unknown agent error',
        stack: agentError instanceof Error ? agentError.stack : undefined,
      });
      throw new Error(
        `Agent execution failed: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`
      );
    }
  } catch (error) {
    logger.error('Contact strategy generation failed', {
      leadId,
      contactId,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

/**
 * Retrieves contact strategy from database instead of JSON cache
 */
export const retrieveContactStrategyFromDatabase = async (
  params: GenerateContactStrategyParams
): Promise<ContactStrategyResult | null> => {
  const { leadId, contactId, tenantId } = params;

  try {
    logger.info('Retrieving contact strategy from database', {
      leadId,
      contactId,
      tenantId,
    });

    // Find existing campaign for this contact and channel (email)
    const existingCampaign = await contactCampaignRepository.findByContactAndChannelForTenant(
      tenantId,
      contactId,
      'email'
    );

    if (!existingCampaign) {
      logger.info('No existing campaign found in database', {
        leadId,
        contactId,
        tenantId,
      });
      return null;
    }

    // Get the latest plan version for this campaign
    const latestPlanVersion = await campaignPlanVersionRepository.findByCampaignAndVersionForTenant(
      tenantId,
      existingCampaign.id,
      existingCampaign.planVersion
    );

    if (!latestPlanVersion) {
      logger.warn('Campaign exists but no plan version found', {
        leadId,
        contactId,
        tenantId,
        campaignId: existingCampaign.id,
        planVersion: existingCampaign.planVersion,
      });
      return null;
    }

    // Reconstruct ContactStrategyResult from database data
    const result: ContactStrategyResult = {
      finalResponse: 'Retrieved from database',
      finalResponseParsed: latestPlanVersion.planJson as any, // This contains the CampaignPlanOutput
      totalIterations: 1,
      functionCalls: [],
    };

    logger.info('Successfully retrieved contact strategy from database', {
      leadId,
      contactId,
      tenantId,
      campaignId: existingCampaign.id,
      planVersion: latestPlanVersion.version,
    });

    return result;
  } catch (error) {
    logger.error('Failed to retrieve contact strategy from database', {
      leadId,
      contactId,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
};
