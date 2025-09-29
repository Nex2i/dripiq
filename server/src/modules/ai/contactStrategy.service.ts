import { logger } from '@/libs/logger';
import { contactCampaignRepository, campaignPlanVersionRepository } from '@/repositories';
import { contactCampaignPlanService } from '../campaign/contactCampaignPlan.service';
import { mapEmailContentToCampaignPlan } from '../campaign/campaignContentMapper.service';
import { updateContactStrategyStatus } from '../contact.service';
import { createContactStrategyAgent, defaultLangChainConfig } from './langchain';
import {
  CampaignPlanOutput,
  campaignPlanOutputSchema,
} from './schemas/contactCampaignStrategySchema';

// Updated result type that returns the complete campaign plan
export type ContactStrategyServiceResult = {
  finalResponse: string;
  finalResponseParsed: CampaignPlanOutput;
  totalIterations: number;
  functionCalls: any[];
};

export interface GenerateContactStrategyParams {
  leadId: string;
  contactId: string;
  tenantId: string;
  userId?: string;
}

export interface UpdateContactStrategyParams {
  leadId: string;
  contactId: string;
  tenantId: string;
  userId?: string;
  updatedPlan: CampaignPlanOutput;
}

/**
 * Service to generate contact strategy and outreach plan for a specific contact
 */
export const generateContactStrategy = async (
  params: GenerateContactStrategyParams
): Promise<ContactStrategyServiceResult> => {
  const { leadId, contactId, tenantId, userId } = params;

  try {
    // Set status to 'generating' at the start
    await updateContactStrategyStatus(tenantId, leadId, contactId, 'generating');

    // Check if contact strategy exists in database
    const existingStrategy = await retrieveContactStrategyFromDatabase(params);
    if (existingStrategy) {
      // Update status to 'completed' since strategy exists
      await updateContactStrategyStatus(tenantId, leadId, contactId, 'completed');
      logger.info('Found existing contact strategy in database, returning live data', {
        leadId,
        contactId,
        tenantId,
      });
      return existingStrategy;
    }

    // Execute agent analysis to generate email content
    try {
      const agent = createContactStrategyAgent({ ...defaultLangChainConfig });
      const emailContentResult = await agent.generateEmailContent(tenantId, leadId, contactId, {
        tenantId,
      });

      // Map email content to static campaign template
      let campaignPlan: CampaignPlanOutput;
      try {
        campaignPlan = mapEmailContentToCampaignPlan(emailContentResult.finalResponseParsed);
      } catch (mappingError) {
        // Update status to 'failed' on mapping error
        await updateContactStrategyStatus(tenantId, leadId, contactId, 'failed');
        logger.error('Failed to map email content to campaign template', {
          tenantId,
          leadId,
          contactId,
          error: mappingError instanceof Error ? mappingError.message : 'Unknown mapping error',
          emailContent: emailContentResult.finalResponseParsed,
        });
        throw new Error(
          `Campaign mapping failed: ${mappingError instanceof Error ? mappingError.message : 'Unknown error'}`
        );
      }

      // Persist the mapped plan into campaign tables (idempotent)
      try {
        await contactCampaignPlanService.persistPlan({
          tenantId,
          leadId,
          contactId,
          userId,
          plan: campaignPlan,
          channel: 'email',
        });
      } catch (dbError) {
        // Update status to 'failed' on persistence error
        await updateContactStrategyStatus(tenantId, leadId, contactId, 'failed');
        logger.error('Failed to persist campaign plan to database', {
          tenantId,
          leadId,
          contactId,
          error: dbError instanceof Error ? dbError.message : 'Unknown DB error',
        });
        throw dbError;
      }

      // Update status to 'completed' on successful generation
      await updateContactStrategyStatus(tenantId, leadId, contactId, 'completed');

      // Return result in the expected format (backwards compatible)
      const result = {
        finalResponse: emailContentResult.finalResponse,
        finalResponseParsed: campaignPlan, // Now returns the complete campaign plan
        totalIterations: emailContentResult.totalIterations,
        functionCalls: emailContentResult.functionCalls,
      };

      return result;
    } catch (agentError) {
      // Update status to 'failed' on agent error
      await updateContactStrategyStatus(tenantId, leadId, contactId, 'failed');
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
    // Update status to 'failed' on any other error
    try {
      await updateContactStrategyStatus(tenantId, leadId, contactId, 'failed');
    } catch (statusError) {
      logger.error('Failed to update contact strategy status to failed', {
        leadId,
        contactId,
        tenantId,
        error: statusError instanceof Error ? statusError.message : 'Unknown status error',
      });
    }

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
): Promise<ContactStrategyServiceResult | null> => {
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

    // Reconstruct ContactStrategyServiceResult from database data
    const result: ContactStrategyServiceResult = {
      finalResponse: 'Retrieved from database',
      finalResponseParsed: latestPlanVersion.planJson as CampaignPlanOutput,
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

/**
 * Service to update an existing contact strategy with new data
 */
export const updateContactStrategy = async (
  params: UpdateContactStrategyParams
): Promise<ContactStrategyServiceResult> => {
  const { leadId, contactId, tenantId, userId, updatedPlan } = params;

  try {
    logger.info('Updating contact strategy', {
      leadId,
      contactId,
      tenantId,
    });

    // Validate the updated plan against the schema
    const validatedPlan = campaignPlanOutputSchema.parse(updatedPlan);

    // Find existing campaign for this contact and channel (email)
    const existingCampaign = await contactCampaignRepository.findByContactAndChannelForTenant(
      tenantId,
      contactId,
      'email'
    );

    if (!existingCampaign) {
      throw new Error('No existing campaign found to update');
    }

    // Update the campaign plan using the service
    await contactCampaignPlanService.persistPlan({
      tenantId,
      leadId,
      contactId,
      userId,
      plan: validatedPlan,
      channel: 'email',
    });

    // Return the updated plan in the expected format
    const result: ContactStrategyServiceResult = {
      finalResponse: 'Plan updated successfully',
      finalResponseParsed: validatedPlan,
      totalIterations: 1,
      functionCalls: [],
    };

    logger.info('Successfully updated contact strategy', {
      leadId,
      contactId,
      tenantId,
    });

    return result;
  } catch (error) {
    logger.error('Contact strategy update failed', {
      leadId,
      contactId,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};
