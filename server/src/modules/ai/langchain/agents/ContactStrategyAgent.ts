import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@/libs/logger';
import {
  leadPointOfContactRepository,
  leadProductRepository,
  leadRepository,
  siteEmbeddingRepository,
} from '@/repositories';
import { TenantService } from '@/modules/tenant.service';
import { LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import {
  LeadDetails,
  leadDetailsSchema,
  contactDetailsSchema,
  ContactDetails,
  partnerDetailsSchema,
  PartnerDetails,
  PartnerProduct,
  partnerProductSchema,
  salesmanSchema,
  Salesman,
} from '../../schemas/contactCampaignStrategyInputSchemas';
import { EmailContentOutput, emailContentOutputSchema } from '../../schemas/emailContentSchema';
import { DefaultAgentExecuter } from './AgentExecuter';

export type ContactStrategyResult = {
  finalResponseParsed: EmailContentOutput;
  totalIterations: number;
  functionCalls: any[];
};

type ValueSchema<T> = {
  description: string;
  value: T;
  schema: any;
};

export class ContactStrategyAgent {
  private config: LangChainConfig;
  private tools: DynamicStructuredTool[];

  constructor(config: LangChainConfig) {
    this.config = config;

    this.tools = [ListDomainPagesTool, GetInformationAboutDomainTool, RetrieveFullPageTool];
  }

  async execute(
    tenantId: string,
    leadId: string,
    contactId: string
  ): Promise<ContactStrategyResult> {
    const startTime = Date.now();

    // Gather metadata for tracing
    const [leadDetails, contactDetails, partnerDetails, partnerProducts, salesman] =
      await Promise.all([
        this.getLeadDetails(tenantId, leadId),
        this.getContactDetails(contactId),
        this.getPartnerDetails(tenantId),
        this.getPartnerProducts(tenantId, leadId),
        this.getSalesman(tenantId, leadId),
      ]);

    try {
      // Prepare variables for prompt injection
      const variables = {
        lead_details: JSON.stringify(
          {
            description: leadDetails.description,
            value: leadDetails.value,
            schema: leadDetails.schema,
          },
          null,
          2
        ),
        contact_details: JSON.stringify(
          {
            description: contactDetails.description,
            value: contactDetails.value,
            schema: contactDetails.schema,
          },
          null,
          2
        ),
        partner_details: JSON.stringify(
          {
            description: partnerDetails.description,
            value: partnerDetails.value,
            schema: partnerDetails.schema,
          },
          null,
          2
        ),
        partner_products: JSON.stringify(
          {
            description: partnerProducts.description,
            value: partnerProducts.value,
            schema: partnerProducts.schema,
          },
          null,
          2
        ),
        salesman: JSON.stringify(
          {
            description: salesman.description,
            value: salesman.value,
            schema: salesman.schema,
          },
          null,
          2
        ),
      };

      const agentResult = await DefaultAgentExecuter<EmailContentOutput>(
        'contact_strategy',
        tenantId,
        variables,
        this.config,
        emailContentOutputSchema,
        this.tools,
        {
          tenantId,
          leadId,
          contactId,
          leadName: leadDetails.value.name,
          contactName: contactDetails.value.name,
          partnerName: partnerDetails.value.name,
        },
        ['contact_strategy']
      );

      const executionTimeMs = Date.now() - startTime;

      logger.info('Successfully generated contact strategy', {
        leadId,
        contactId,
        tenantId,
        emailsGenerated: agentResult.output.emails?.length ?? 0,
        executionTimeMs,
      });

      return {
        finalResponseParsed: agentResult.output,
        totalIterations: agentResult.intermediateSteps?.length ?? 0,
        functionCalls: agentResult.intermediateSteps,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      logger.error('Email content generation failed:', {
        error,
        leadId,
        contactId,
        tenantId,
        executionTimeMs,
      });

      throw error;
    }
  }

  private async getLeadDetails(
    tenantId: string,
    leadId: string
  ): Promise<ValueSchema<LeadDetails>> {
    const leadDetails = await leadRepository.findByIdForTenant(leadId, tenantId);

    return {
      description: 'Lead Details',
      value: {
        id: leadDetails.id,
        name: leadDetails.name || '',
        url: leadDetails.url || '',
        status: leadDetails.status || '',
        summary: leadDetails.summary || '',
        products: JSON.stringify(leadDetails.products) || '',
        services: JSON.stringify(leadDetails.services) || '',
        differentiators: JSON.stringify(leadDetails.differentiators) || '',
        targetMarket: leadDetails.targetMarket || '',
        tone: leadDetails.tone || '',
      },
      schema: z.toJSONSchema(leadDetailsSchema),
    };
  }

  private async getContactDetails(contactId: string): Promise<ValueSchema<ContactDetails>> {
    const contactDetails = await leadPointOfContactRepository.findById(contactId);

    return {
      description: 'Contact Details',
      value: {
        id: contactDetails.id,
        name: contactDetails.name || '',
        title: contactDetails.title || '',
      },
      schema: z.toJSONSchema(contactDetailsSchema),
    };
  }
  private async getPartnerDetails(tenantId: string): Promise<ValueSchema<PartnerDetails>> {
    const tenant = await TenantService.getTenantById(tenantId);

    return {
      description: 'Partner Details',
      value: {
        id: tenant.id,
        name: tenant.name,
        website: tenant.website,
        organizationName: tenant.organizationName,
        summary: tenant.summary,
        differentiators: tenant.differentiators,
        targetMarket: tenant.targetMarket,
        tone: tenant.tone,
      } as PartnerDetails,
      schema: z.toJSONSchema(partnerDetailsSchema),
    };
  }

  private async getPartnerProducts(
    tenantId: string,
    leadId: string
  ): Promise<ValueSchema<PartnerProduct[]>> {
    const leadProducts = await leadProductRepository.findByLeadId(leadId, tenantId);

    // Fetch site content for each product that has a siteUrl
    const productsWithContent = await Promise.all(
      leadProducts.map(async (product) => {
        let siteContent = '';

        // Only fetch site content if siteUrl is not null or empty
        if (!product.siteUrl?.isNullOrEmpty()) {
          siteContent = await this.getSiteContentForUrl(product.siteUrl!);
        }

        return {
          id: product.id,
          title: product.title || '',
          description: product.description || '',
          salesVoice: product.salesVoice || '',
          siteUrl: product.siteUrl || '',
          siteContent,
        };
      })
    );

    return {
      description: 'Partner Products',
      value: productsWithContent,
      schema: z.toJSONSchema(partnerProductSchema),
    };
  }

  private async getSiteContentForUrl(siteUrl: string): Promise<string> {
    try {
      const cleanUrl = siteUrl.cleanWebsiteUrl();
      const embeddings = await siteEmbeddingRepository.findByUrl(cleanUrl);

      if (!embeddings || embeddings.length === 0) {
        return '';
      }

      // Sort by chunk index ascending to maintain proper order
      const sortedEmbeddings = embeddings.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));

      // Combine all content into a single string
      return sortedEmbeddings
        .map((embedding) => embedding.content)
        .filter((content) => content && content.trim())
        .join('\n\n');
    } catch (error) {
      logger.warn('Failed to fetch site content for URL', { siteUrl, error });
      return '';
    }
  }

  private async getSalesman(tenantId: string, leadId: string): Promise<ValueSchema<Salesman>> {
    const lead = await leadRepository.findOwnerForLead(leadId, tenantId);

    return {
      description: 'Salesman',
      value: {
        id: lead.id,
        name: lead.name || '',
        email: lead.email || '',
      },
      schema: z.toJSONSchema(salesmanSchema),
    };
  }
}
