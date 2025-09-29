import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { CallbackHandler } from '@langfuse/langchain';
import { logger } from '@/libs/logger';
import {
  leadPointOfContactRepository,
  leadProductRepository,
  leadRepository,
  siteEmbeddingRepository,
} from '@/repositories';
import { TenantService } from '@/modules/tenant.service';
import { promptManagementService } from '../services/promptManagement.service';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
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
import { getContentFromMessage } from '../utils/messageUtils';
import { EmailContentOutput, emailContentOutputSchema } from '../../schemas/emailContentSchema';

export type ContactStrategyResult = {
  finalResponse: string;
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
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    this.config = config;

    const model = createChatModel(config);

    const tools: DynamicStructuredTool[] = [
      ListDomainPagesTool,
      GetInformationAboutDomainTool,
      RetrieveFullPageTool,
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `{system_prompt}`],
      ['system', `{lead_details}`],
      ['system', `{contact_details}`],
      ['system', `{partner_details}`],
      ['system', `{partner_products}`],
      ['system', `{salesman}`],
      ['system', `{output_schema}`],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const agent = createToolCallingAgent({
      llm: model,
      tools,
      prompt,
    });

    this.agent = new AgentExecutor({
      agent,
      maxIterations: config.maxIterations,
      tools,
      verbose: false,
      returnIntermediateSteps: true,
    });
  }

  async generateEmailContent(
    tenantId: string,
    leadId: string,
    contactId: string
  ): Promise<ContactStrategyResult> {
    const startTime = Date.now();

    // Gather metadata for tracing
    const leadDetails = await this.getLeadDetails(tenantId, leadId);
    const contactDetails = await this.getContactDetails(contactId);
    const partnerDetails = await this.getPartnerDetails(tenantId);

    try {
      // Create LangFuse callback handler for automatic tracing
      // v4 SDK automatically uses LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL from env
      const langfuseHandler = new CallbackHandler({
        userId: tenantId,
        traceMetadata: {
          tenantId,
          leadId,
          contactId,
          leadName: leadDetails.value.name,
          contactName: contactDetails.value.name,
          partnerName: partnerDetails.value.name,
        },
        tags: ['contact_strategy', 'email_generation', 'campaign_creation'],
      });

      // Fetch prompt from LangFuse
      const prompt = await promptManagementService.fetchPrompt('contact_strategy', {
        cacheTtlSeconds: 300, // Cache for 5 minutes
      });

      // Compile prompt (no variables needed for this prompt)
      const systemPrompt = prompt.compile({});

      // Prepare input data
      const partnerProducts = await this.getPartnerProducts(tenantId, leadId);
      const salesman = await this.getSalesman(tenantId, leadId);

      // Invoke the agent with callback handler
      const result = await this.agent.invoke(
        {
          system_prompt: systemPrompt,
          lead_details: leadDetails,
          contact_details: contactDetails,
          partner_details: partnerDetails,
          partner_products: partnerProducts,
          salesman: salesman,
          output_schema: `${JSON.stringify(z.toJSONSchema(emailContentOutputSchema), null, 2)}\n\nIMPORTANT: You must respond with valid JSON only.`,
        },
        {
          callbacks: [langfuseHandler],
          runName: 'contact_strategy_generation',
        }
      );

      let finalResponse = getContentFromMessage(result.output);

      // If agent didn't provide a direct response, try to generate from steps
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        logger.error('Agent did not provide a direct response');
        throw new Error('Agent did not provide a direct response');
      }

      // Enhanced JSON parsing with better error handling
      const parsedResult = parseWithSchema(finalResponse);

      const executionTimeMs = Date.now() - startTime;

      logger.info('Successfully generated contact strategy with LangFuse', {
        leadId,
        contactId,
        tenantId,
        emailsGenerated: parsedResult.emails?.length ?? 0,
        executionTimeMs,
        promptVersion: prompt.version,
      });

      return {
        finalResponse: result.output || finalResponse || 'Email content generation completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
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

// -- Helpers --
function parseWithSchema(content: string): EmailContentOutput {
  try {
    // First, try to find JSON in the content with multiple strategies
    let jsonText = content;

    // Remove markdown code fencing
    jsonText = jsonText.replace(/^```(?:json)?|```$/gm, '').trim();

    // Look for JSON object patterns
    const jsonMatches = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatches) {
      jsonText = jsonMatches[0];
    }

    // Clean up common formatting issues
    jsonText = jsonText.trim();

    // Log what we're trying to parse for debugging
    logger.info('Attempting to parse email content JSON', {
      contentLength: content.length,
      extractedLength: jsonText.length,
      preview: jsonText.substring(0, 200) + (jsonText.length > 200 ? '...' : ''),
    });

    const parsed = JSON.parse(jsonText);
    return emailContentOutputSchema.parse(parsed);
  } catch (parseError) {
    logger.warn('Email content JSON parsing failed', {
      error: parseError instanceof Error ? parseError.message : 'Unknown error',
      contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      contentLength: content.length,
    });

    // Try to extract individual fields if JSON parsing completely fails
    throw new Error('Email content JSON parsing failed');
  }
}
