import { logger } from '@/libs/logger';
import { supabaseStorage } from '@/libs/supabase.storage';
import { ProductsService } from '../products.service';
import { getLeadById } from '../lead.service';
import { TenantService } from '../tenant.service';
import { UserService } from '../user.service';
import type { ContactStrategyResult } from './langchain/agents/ContactStrategyAgent';
import { createContactStrategyAgent, defaultLangChainConfig } from './langchain';

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
  const { leadId, contactId, tenantId } = params;

  try {
    // Check if cached result exists in storage
    const cacheKey = `${tenantId}/${leadId}/${contactId}/contact-strategy.json`;

    logger.info('Checking for cached contact strategy result', {
      leadId,
      contactId,
      tenantId,
      cacheKey,
    });

    const cachedResult = await supabaseStorage.downloadFile(cacheKey);
    if (cachedResult) {
      logger.info('Found cached contact strategy result, returning cached data', {
        leadId,
        contactId,
        tenantId,
        cacheKey,
      });
      return cachedResult;
    }

    // Get lead details
    const lead = await getLeadById(tenantId, leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Get lead contacts
    const leadContacts = lead.pointOfContacts || [];
    if (leadContacts.length === 0) {
      throw new Error('No contacts found for this lead');
    }

    // Get specific contact by ID
    const contact = leadContacts.find((c) => c.id === contactId);
    if (!contact) {
      throw new Error(`Contact not found with ID ${contactId}`);
    }

    // Get tenant details
    const tenant = await TenantService.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Get lead products
    const leadProducts = await ProductsService.getProducts(leadId);

    let getLeadOwner;

    if (lead.ownerId) {
      getLeadOwner = await UserService.getUserById(lead.ownerId);
    }

    // Prepare agent input
    const agentInput = {
      leadDetails: {
        id: lead.id,
        name: lead.name,
        url: lead.url,
        summary: lead.summary,
        products: lead.products || [],
        services: lead.services || [],
        differentiators: lead.differentiators || [],
        targetMarket: lead.targetMarket,
        tone: lead.tone,
        status: lead.status,
      },
      contactDetails: contact,
      partnerDetails: {
        id: tenant.id,
        name: tenant.name,
        website: tenant.website,
        organizationName: tenant.organizationName,
        summary: tenant.summary,
        differentiators: tenant.differentiators,
        targetMarket: tenant.targetMarket,
        tone: tenant.tone,
        // Add any other relevant tenant information
      },
      salesman: {
        id: getLeadOwner?.id,
        name: getLeadOwner?.name,
        email: getLeadOwner?.email,
      },
      partnerProducts: leadProducts.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        salesVoice: product.salesVoice,
      })),
    };

    // Execute agent analysis
    try {
      const agent = createContactStrategyAgent({ ...defaultLangChainConfig, model: 'gpt-4.1' });
      const result = await agent.generateContactStrategy(agentInput);

      // Save result to cache
      try {
        await supabaseStorage.uploadJsonFile(cacheKey, result);
        logger.info('Successfully cached contact strategy result', {
          leadId,
          contactId,
          tenantId,
          cacheKey,
        });
      } catch (cacheError) {
        logger.error('Failed to cache contact strategy result', {
          leadId,
          contactId,
          tenantId,
          cacheKey,
          error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error',
        });
        // Don't throw error for cache failures - return the result anyway
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
