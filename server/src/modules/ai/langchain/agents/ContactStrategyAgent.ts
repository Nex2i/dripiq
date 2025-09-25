import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promptHelper } from '@/prompts/prompt.helper';
import { logger } from '@/libs/logger';
import {
  leadPointOfContactRepository,
  leadProductRepository,
  leadRepository,
  siteEmbeddingRepository,
} from '@/repositories';
import { TenantService } from '@/modules/tenant.service';
import { createInstrumentedChatModel, LangChainConfig } from '../config/langchain.config';
import { langfuseService } from '../../observability/langfuse.service';
import { promptService } from '../../observability/prompt.service';
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
  traceId?: string;
};

export interface ContactStrategyOptions {
  enableTracing?: boolean;
  sessionId?: string;
  metadata?: Record<string, any>;
}

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

    const model = createInstrumentedChatModel('ContactStrategyAgent', {}, config);

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
    contactId: string,
    options: ContactStrategyOptions = {}
  ): Promise<ContactStrategyResult> {
    const {
      enableTracing = true,
      sessionId = `contact_strategy_${leadId}_${contactId}_${Date.now()}`,
      metadata = {},
    } = options;

    // Create trace for this generation
    let trace = null;
    let traceId: string | undefined;

    if (enableTracing && langfuseService.isReady()) {
      trace = langfuseService.createTrace(`Contact Strategy: Lead ${leadId}`, {
        tenantId,
        sessionId,
        agentType: 'ContactStrategyAgent',
        metadata: { leadId, contactId, ...metadata },
      });
      traceId = trace?.id;
    }
    let systemPrompt: string;
    try {
      // Get prompt (try remote first, fallback to local)
      const { prompt: systemPromptTemplate } = await promptService.getPrompt('contact_strategy', {
        useRemote: true,
        fallbackToLocal: true,
      });
      systemPrompt = promptHelper.injectInputVariables(systemPromptTemplate, {});
    } catch (error) {
      logger.error('Error preparing prompt variables', error);
      throw new Error(
        `Failed to prepare prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    try {
      // Log generation start
      langfuseService.logEvent(
        'contact_strategy_started',
        {
          leadId,
          contactId,
        },
        {
          tenantId,
          sessionId,
          agentType: 'ContactStrategyAgent',
          metadata,
        }
      );

      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
        lead_details: await this.getLeadDetails(tenantId, leadId),
        contact_details: await this.getContactDetails(contactId),
        partner_details: await this.getPartnerDetails(tenantId),
        partner_products: await this.getPartnerProducts(tenantId, leadId),
        salesman: await this.getSalesman(tenantId, leadId),
        output_schema: `${JSON.stringify(z.toJSONSchema(emailContentOutputSchema), null, 2)}\n\nIMPORTANT: You must respond with valid JSON only.`,
      });

      let finalResponse = getContentFromMessage(result.output);

      // If agent didn't provide a direct response, try to generate from steps
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        logger.error('Agent did not provide a direct response, trying direct model approach');
        throw new Error('Agent did not provide a direct response');
      }

      // Enhanced JSON parsing with better error handling
      const parsedResult = parseWithSchema(finalResponse);

      // Log successful completion
      langfuseService.logEvent(
        'contact_strategy_completed',
        {
          leadId,
          contactId,
          totalIterations: result.intermediateSteps?.length ?? 0,
          success: true,
        },
        {
          tenantId,
          sessionId,
          agentType: 'ContactStrategyAgent',
          metadata,
        }
      );

      // Score the generation if we have a trace
      if (trace && parsedResult) {
        langfuseService.score(
          trace.id,
          'strategy_quality',
          0.8,
          'Contact strategy generated successfully'
        );
      }

      return {
        finalResponse: result.output || finalResponse || 'Email content generation completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
        traceId,
      };
    } catch (error) {
      // Log error
      langfuseService.logEvent(
        'contact_strategy_error',
        {
          leadId,
          contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        {
          tenantId,
          sessionId,
          agentType: 'ContactStrategyAgent',
          metadata,
        }
      );

      // Score the error if we have a trace
      if (trace) {
        langfuseService.score(
          trace.id,
          'strategy_quality',
          0.1,
          `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      logger.error('Email content generation failed:', error);
      throw error;
    } finally {
      // Flush events
      await langfuseService.flush();
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
