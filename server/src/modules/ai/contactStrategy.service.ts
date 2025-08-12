import { logger } from '@/libs/logger';
import { supabaseStorage } from '@/libs/supabase.storage';
import type { ContactStrategyResult } from './langchain/agents/ContactStrategyAgent';
import { createContactStrategyAgent, defaultLangChainConfig } from './langchain';
import { contactCampaignPlanService } from './contactCampaignPlan.service';

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
    // Check if cached result exists in storage
    const cacheKey = `${tenantId}/${leadId}/${contactId}/contact-strategy.json`;

    logger.info('Checking for cached contact strategy result', {
      leadId,
      contactId,
      tenantId,
      cacheKey,
    });

    const isResultCached = await supabaseStorage.fileExists(cacheKey);
    if (isResultCached) {
      logger.info('Found cached contact strategy result, returning cached data', {
        leadId,
        contactId,
        tenantId,
        cacheKey,
      });
      const cachedResult = await supabaseStorage.downloadFile(cacheKey);
      return cachedResult;
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

      await cacheContactStrategy(result, cacheKey);

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

async function cacheContactStrategy(result: ContactStrategyResult, cacheKey: string) {
  // Save result to cache
  try {
    await supabaseStorage.uploadJsonFile(cacheKey, result);
  } catch (cacheError) {
    logger.error('Failed to cache contact strategy result', {
      cacheKey,
      error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error',
    });
    // Don't throw error for cache failures - return the result anyway
  }
}
