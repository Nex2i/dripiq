import { logger } from '@/libs/logger';
import { supabaseStorage } from '@/libs/supabase.storage';
import { ProductsService } from '../products.service';
import { getLeadById } from '../lead.service';
import { TenantService } from '../tenant.service';
import type { LeadQualificationResult } from './langchain/agents/LeadQualificationAgent';
import { getLeadQualificationAgent } from './langchain';

export interface QualifyLeadContactParams {
  leadId: string;
  contactId: string;
  tenantId: string;
  userId?: string;
}

/**
 * Service to qualify a lead and generate outreach strategy for a specific contact
 */
export const qualifyLeadContact = async (
  params: QualifyLeadContactParams
): Promise<LeadQualificationResult> => {
  const { leadId, contactId, tenantId, userId } = params;

  try {
    // Check if cached result exists in storage
    const cacheKey = `${tenantId}/${leadId}/${contactId}/qualify.json`;

    logger.info('Checking for cached qualification result', {
      leadId,
      contactId,
      tenantId,
      cacheKey,
    });

    const cachedResult = await supabaseStorage.downloadFile(cacheKey);
    if (cachedResult) {
      logger.info('Found cached qualification result, returning cached data', {
        leadId,
        contactId,
        tenantId,
        cacheKey,
      });
      return cachedResult;
    }

    logger.info('No cached result found, proceeding with qualification', {
      leadId,
      contactId,
      tenantId,
      cacheKey,
    });
    // Verify user access if userId provided
    if (userId) {
      const hasAccess = await ProductsService.checkUserAccess(userId, tenantId);
      if (!hasAccess) {
        throw new Error('Access denied to this tenant');
      }
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

    // Get tenant products
    const tenantProducts = await ProductsService.getProducts(tenantId);

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
      partnerProducts: tenantProducts.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        salesVoice: product.salesVoice,
      })),
    };

    // Log input data for debugging
    logger.info('Preparing agent input', {
      leadId,
      contactId,
      tenantId,
      leadData: {
        id: lead.id,
        name: lead.name,
        summary: lead.summary,
        targetMarket: lead.targetMarket,
        tone: lead.tone,
      },
      contactData: contact,
      tenantData: {
        id: tenant.id,
        name: tenant.name,
        website: tenant.website,
        organizationName: tenant.organizationName,
        summary: tenant.summary,
      },
      productsCount: tenantProducts?.length || 0,
    });

    // Execute agent analysis
    try {
      const agent = getLeadQualificationAgent();
      const result = await agent.qualifyLead(agentInput);

      // Save result to cache
      try {
        await supabaseStorage.uploadJsonFile(cacheKey, result);
        logger.info('Successfully cached qualification result', {
          leadId,
          contactId,
          tenantId,
          cacheKey,
        });
      } catch (cacheError) {
        logger.error('Failed to cache qualification result', {
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
    logger.error('Lead qualification failed', {
      leadId,
      contactId,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};
