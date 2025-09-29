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
import {
  getObservabilityServices,
  type EnhancedAgentResult,
  type AgentExecutionOptions,
} from '../../observability';

export type ContactStrategyResult = EnhancedAgentResult<EmailContentOutput>;

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
    contactId: string,
    options: AgentExecutionOptions = {}
  ): Promise<ContactStrategyResult> {
    const startTime = Date.now();
    let trace: any = null;
    let observabilityServices: any = null;

    try {
      // Try to initialize observability services if tracing is enabled
      if (options.enableTracing !== false) {
        try {
          observabilityServices = await getObservabilityServices();
        } catch (error) {
          logger.debug('Observability services not available - continuing without tracing', {
            tenantId,
            leadId,
            contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Create trace if observability is available
      if (observabilityServices?.langfuseService?.isAvailable()) {
        const traceResult = observabilityServices.langfuseService.createTrace(
          'contact-strategy',
          { tenantId, leadId, contactId },
          {
            agentName: 'ContactStrategyAgent',
            agentVersion: '1.0.0-enhanced',
            input: { tenantId, leadId, contactId },
            tenantId: options.tenantId || tenantId,
            userId: options.userId,
            sessionId: options.sessionId,
            custom: options.metadata,
          }
        );
        trace = traceResult.trace;
      }

      // Get prompt (fallback to old system if observability not available)
      let systemPrompt: string;
      try {
        if (observabilityServices?.promptService) {
          const promptResult = await observabilityServices.promptService.getPrompt(
            'contact_strategy',
            { cacheTtlSeconds: options.promptCacheTtl }
          );
          systemPrompt = promptResult.prompt;
        } else {
          // Fallback to old prompt system
          systemPrompt = promptHelper.getPromptAndInject('contact_strategy', {});
        }
      } catch (error) {
        logger.warn('Failed to get prompt from observability system, using fallback', { error });
        systemPrompt = promptHelper.getPromptAndInject('contact_strategy', {});
      }

      // Fetch all required data with tracing
      const leadDetailsSpan = trace ? observabilityServices.langfuseService.createSpan(
        trace,
        'fetch-lead-details',
        { tenantId, leadId }
      ) : null;

      const leadDetails = await this.getLeadDetails(tenantId, leadId);
      
      if (leadDetailsSpan) {
        observabilityServices.langfuseService.updateSpan(
          leadDetailsSpan,
          { leadName: leadDetails.value.name },
          { success: true }
        );
      }

      const contactDetails = await this.getContactDetails(contactId);
      const partnerDetails = await this.getPartnerDetails(tenantId);
      const partnerProducts = await this.getPartnerProducts(tenantId, leadId);
      const salesman = await this.getSalesman(tenantId, leadId);

      // Log data retrieval
      if (trace) {
        observabilityServices.langfuseService.logEvent(
          trace,
          'data-retrieved',
          { tenantId, leadId, contactId },
          {
            leadName: leadDetails.value.name,
            contactName: contactDetails.value.name,
            partnerName: partnerDetails.value.name,
            productCount: partnerProducts.value.length,
            salesmanName: salesman.value.name,
          }
        );
      }

      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
        lead_details: leadDetails,
        contact_details: contactDetails,
        partner_details: partnerDetails,
        partner_products: partnerProducts,
        salesman: salesman,
        output_schema: `${JSON.stringify(z.toJSONSchema(emailContentOutputSchema), null, 2)}\n\nIMPORTANT: You must respond with valid JSON only.`,
      });

      let finalResponse = getContentFromMessage(result.output);

      // If agent didn't provide a direct response, try to generate from steps
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        logger.error('Agent did not provide a direct response, trying direct model approach');
        
        if (trace) {
          observabilityServices.langfuseService.logEvent(
            trace,
            'no-direct-response',
            { intermediateStepsCount: result.intermediateSteps.length }
          );
        }
        
        throw new Error('Agent did not provide a direct response');
      }

      // Enhanced JSON parsing with better error handling
      const parsedResult = parseWithSchema(finalResponse);
      const executionTimeMs = Date.now() - startTime;

      // Log successful completion
      if (trace) {
        observabilityServices.langfuseService.logEvent(
          trace,
          'email-generation-completed',
          { tenantId, leadId, contactId },
          {
            emailCount: parsedResult.emails?.length || 0,
            executionTimeMs,
            success: true,
          }
        );

        // Update trace with success
        observabilityServices.langfuseService.updateTrace(
          trace,
          { finalResponse: parsedResult, executionTimeMs },
          { 
            success: true, 
            tenantId, 
            leadId, 
            contactId,
            emailCount: parsedResult.emails?.length || 0,
          }
        );
      }

      return {
        finalResponse: result.output || finalResponse || 'Email content generation completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
        traceId: trace?.id || null,
        metadata: {
          executionTimeMs,
          agentMetadata: {
            tenantId,
            leadId,
            contactId,
            emailCount: parsedResult.emails?.length || 0,
          },
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      logger.error('Email content generation failed:', error);

      // Log error to trace
      if (trace && observabilityServices) {
        observabilityServices.langfuseService.logError(trace, error as Error, {
          phase: 'email-generation',
          tenantId,
          leadId,
          contactId,
        });
        observabilityServices.langfuseService.updateTrace(
          trace,
          null,
          { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            tenantId,
            leadId,
            contactId,
          }
        );
      }

      // Rethrow error with enhanced context
      const enhancedError = new Error(
        `Email content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      (enhancedError as any).traceId = trace?.id || null;
      (enhancedError as any).metadata = {
        executionTimeMs,
        tenantId,
        leadId,
        contactId,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          phase: 'email-generation',
          timestamp: new Date().toISOString(),
        }],
      };

      throw enhancedError;
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
