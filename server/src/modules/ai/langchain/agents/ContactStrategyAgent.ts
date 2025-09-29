import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
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

/**
 * LangFuse-First Contact Strategy Agent
 * 
 * Features:
 * - Required LangFuse observability (no fallbacks)
 * - LangFuse-managed prompts only
 * - Full tracing and performance monitoring
 * - Detailed data retrieval tracing
 * - Enhanced error handling with trace context
 * - Clean, modern API design
 */
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

  /**
   * Generate email content with full LangFuse observability
   * 
   * @param tenantId - The tenant ID
   * @param leadId - The lead ID 
   * @param contactId - The contact ID
   * @param options - Execution options including tracing context
   * @returns Enhanced email content generation result with trace information
   * @throws Error if observability services are not available or data retrieval fails
   */
  async generateEmailContent(
    tenantId: string,
    leadId: string,
    contactId: string,
    options: AgentExecutionOptions
  ): Promise<ContactStrategyResult> {
    const startTime = Date.now();

    // Require observability services - fail fast if not available
    const observabilityServices = await getObservabilityServices();
    
    if (!observabilityServices.langfuseService.isAvailable()) {
      throw new Error(
        'LangFuse service is not available. Contact strategy generation requires observability services. ' +
        'Please check your LangFuse configuration.'
      );
    }

    // Create trace - required for all executions
    const traceResult = observabilityServices.langfuseService.createTrace(
      'contact-strategy',
      { tenantId, leadId, contactId },
      {
        agentName: 'ContactStrategyAgent',
        agentVersion: '2.0.0-langfuse-first',
        input: { tenantId, leadId, contactId },
        tenantId: options.tenantId || tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
        custom: options.metadata,
      }
    );
    
    const trace = traceResult.trace;
    if (!trace) {
      throw new Error('Failed to create LangFuse trace for contact strategy generation');
    }

    try {
      logger.info('Contact strategy generation started with LangFuse tracing', {
        tenantId,
        leadId,
        contactId,
        traceId: traceResult.traceId,
      });

      // Get prompt from LangFuse - required, no fallbacks
      const promptResult = await observabilityServices.promptService.getPrompt(
        'contact_strategy',
        { cacheTtlSeconds: options.promptCacheTtl }
      );

      // Log prompt retrieval
      observabilityServices.langfuseService.logEvent(
        trace,
        'prompt-retrieved',
        { 
          promptName: 'contact_strategy',
          tenantId,
          leadId,
          contactId,
        },
        { 
          cached: promptResult.cached,
          version: promptResult.version,
          source: promptResult.metadata?.source,
        }
      );

      // Fetch all required data with detailed tracing
      const dataRetrievalSpan = observabilityServices.langfuseService.createSpan(
        trace,
        'data-retrieval',
        { tenantId, leadId, contactId }
      );

      const [leadDetails, contactDetails, partnerDetails, partnerProducts, salesman] = 
        await Promise.all([
          this.getLeadDetails(tenantId, leadId),
          this.getContactDetails(contactId),
          this.getPartnerDetails(tenantId),
          this.getPartnerProducts(tenantId, leadId),
          this.getSalesman(tenantId, leadId),
        ]);

      observabilityServices.langfuseService.updateSpan(
        dataRetrievalSpan,
        {
          leadName: leadDetails.value.name,
          contactName: contactDetails.value.name,
          partnerName: partnerDetails.value.name,
          productCount: partnerProducts.value.length,
          salesmanName: salesman.value.name,
        },
        { success: true }
      );

      // Log data retrieval completion
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

      // Execute the agent
      const result = await this.agent.invoke({
        system_prompt: promptResult.prompt,
        lead_details: leadDetails,
        contact_details: contactDetails,
        partner_details: partnerDetails,
        partner_products: partnerProducts,
        salesman: salesman,
        output_schema: `${JSON.stringify(z.toJSONSchema(emailContentOutputSchema), null, 2)}\n\nIMPORTANT: You must respond with valid JSON only.`,
      });

      let finalResponse = getContentFromMessage(result.output);

      // Check for direct response
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        observabilityServices.langfuseService.logEvent(
          trace,
          'no-direct-response',
          { intermediateStepsCount: result.intermediateSteps.length }
        );
        
        throw new Error(
          'Agent did not provide a direct response for email content generation. ' +
          'This typically indicates a prompt or configuration issue.'
        );
      }

      // Parse the final result
      const parsedResult = this.parseWithSchema(finalResponse);
      const executionTimeMs = Date.now() - startTime;

      // Log successful completion
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

      // Update trace with final results
      observabilityServices.langfuseService.updateTrace(
        trace,
        {
          finalResponse: parsedResult,
          totalIterations: result.intermediateSteps?.length ?? 0,
          executionTimeMs,
        },
        { 
          success: true, 
          tenantId, 
          leadId, 
          contactId,
          emailCount: parsedResult.emails?.length || 0,
        }
      );

      return {
        finalResponse: result.output || finalResponse || 'Email content generation completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
        traceId: traceResult.traceId,
        metadata: {
          executionTimeMs,
          agentMetadata: {
            tenantId,
            leadId,
            contactId,
            emailCount: parsedResult.emails?.length || 0,
            promptVersion: promptResult.version,
            promptCached: promptResult.cached,
          },
        },
      };

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      logger.error('Email content generation failed', {
        tenantId,
        leadId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        traceId: traceResult.traceId,
      });

      // Log error to trace
      observabilityServices.langfuseService.logError(trace, error as Error, {
        phase: 'email-generation',
        tenantId,
        leadId,
        contactId,
        executionTimeMs,
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
          executionTimeMs,
        }
      );

      // Enhanced error with trace context
      const enhancedError = new Error(
        `Email content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      (enhancedError as any).traceId = traceResult.traceId;
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

  private parseWithSchema(content: string): EmailContentOutput {
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
      logger.debug('Attempting to parse email content JSON', {
        contentLength: content.length,
        extractedLength: jsonText.length,
        preview: jsonText.substring(0, 200) + (jsonText.length > 200 ? '...' : ''),
      });

      const parsed = JSON.parse(jsonText);
      return emailContentOutputSchema.parse(parsed);
    } catch (parseError) {
      logger.error('Email content JSON parsing failed', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        contentLength: content.length,
      });

      throw new Error(
        `Failed to parse email content JSON: ${
          parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        }`
      );
    }
  }
}