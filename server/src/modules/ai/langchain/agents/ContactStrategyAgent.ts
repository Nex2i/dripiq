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
import { BaseObservableAgent } from '../../observability/base-agent';
import { 
  AgentExecutionOptions, 
  AgentExecutionResult, 
  AgentTracingContext,
  PromptInjectionContext,
  AgentError,
  AgentErrorType 
} from '../../observability/types';
import { langfuseService } from '../../observability/langfuse.service';

export type ContactStrategyResult = AgentExecutionResult<EmailContentOutput>;

export interface ContactStrategyInput {
  tenantId: string;
  leadId: string;
  contactId: string;
}

type ValueSchema<T> = {
  description: string;
  value: T;
  schema: any;
};

export class ContactStrategyAgent extends BaseObservableAgent<ContactStrategyInput, EmailContentOutput> {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    super();
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

  protected getAgentName(): string {
    return 'ContactStrategyAgent';
  }

  protected getAgentVersion(): string {
    return '2.0.0';
  }

  protected getPromptName(): string {
    return 'contact_strategy';
  }

  protected getAgentDescription(): string {
    return 'Generates personalized email content for contact campaigns using lead, contact, and partner information';
  }

  protected preparePromptContext(input: ContactStrategyInput): PromptInjectionContext {
    return {
      variables: {
        // Variables will be gathered and injected in executeCore
        tenantId: input.tenantId,
        leadId: input.leadId,
        contactId: input.contactId,
      },
    };
  }

  protected async executeCore(
    input: ContactStrategyInput,
    promptContent: string,
    context: AgentTracingContext
  ): Promise<{
    finalResponse: string;
    finalResponseParsed: EmailContentOutput;
    totalIterations: number;
    functionCalls: any[];
  }> {
    // Create spans for data gathering
    const dataGatheringSpan = context ? langfuseService.createSpan(context.trace, {
      name: 'contact_strategy_data_gathering',
      metadata: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        contactId: input.contactId,
      },
    }) : null;

    let contextData: {
      lead_details: string;
      contact_details: string;
      partner_details: string;
      partner_products: string;
      salesman: string;
    };

    try {
      // Gather all required context data
      const [leadDetails, contactDetails, partnerDetails, partnerProducts, salesmanDetails] = await Promise.all([
        this.getLeadDetails(input.tenantId, input.leadId),
        this.getContactDetails(input.contactId),
        this.getPartnerDetails(input.tenantId),
        this.getPartnerProducts(input.tenantId, input.leadId),
        this.getSalesman(input.tenantId, input.leadId),
      ]);

      contextData = {
        lead_details: JSON.stringify(leadDetails, null, 2),
        contact_details: JSON.stringify(contactDetails, null, 2),
        partner_details: JSON.stringify(partnerDetails, null, 2),
        partner_products: JSON.stringify(partnerProducts, null, 2),
        salesman: JSON.stringify(salesmanDetails, null, 2),
      };

      if (dataGatheringSpan) {
        langfuseService.updateElement(dataGatheringSpan, {
          output: {
            success: true,
            dataTypes: Object.keys(contextData),
            leadDetailsSize: contextData.lead_details.length,
            partnerProductsCount: partnerProducts.value.length,
          },
        });
        langfuseService.endElement(dataGatheringSpan);
      }

    } catch (error) {
      if (dataGatheringSpan) {
        langfuseService.updateElement(dataGatheringSpan, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(dataGatheringSpan);
      }

      throw new AgentError(
        AgentErrorType.VALIDATION_ERROR,
        `Failed to gather context data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          tenantId: input.tenantId,
          leadId: input.leadId,
          contactId: input.contactId,
          agentName: this.getAgentName() 
        },
        context?.trace?.id
      );
    }

    // Create generation for LLM tracking
    const generation = context ? langfuseService.createGeneration(context.trace, {
      name: 'contact_strategy_generation',
      model: this.config.model,
      input: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        contactId: input.contactId,
        promptLength: promptContent.length,
        contextDataSize: Object.values(contextData).reduce((sum, val) => sum + val.length, 0),
      },
    }) : null;

    try {
      const result = await this.agent.invoke({
        system_prompt: promptContent,
        ...contextData,
        output_schema: `${JSON.stringify(z.toJSONSchema(emailContentOutputSchema), null, 2)}\n\nIMPORTANT: You must respond with valid JSON only.`,
      });

      let finalResponse = getContentFromMessage(result.output);

      // If agent didn't provide a direct response, fail immediately
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        logger.error('Agent did not provide a direct response for contact strategy');
        throw new Error('Agent did not provide a direct response');
      }

      // Parse the email content
      const parsedResult = parseWithSchema(finalResponse);

      // Update generation with success
      if (generation) {
        langfuseService.updateElement(generation, {
          output: {
            success: true,
            responseLength: finalResponse.length,
            iterations: result.intermediateSteps?.length ?? 0,
            emailSubject: parsedResult.subject,
            emailBodyLength: parsedResult.body?.length || 0,
          },
        });
        langfuseService.endElement(generation);
      }

      // Track function calls as events
      if (context && result.intermediateSteps) {
        this.trackFunctionCalls(context, result.intermediateSteps);
      }

      return {
        finalResponse: result.output || finalResponse || 'Email content generation completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
      };

    } catch (error) {
      // Update generation with error
      if (generation) {
        langfuseService.updateElement(generation, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(generation);
      }

      logger.error('Contact strategy generation failed', {
        tenantId: input.tenantId,
        leadId: input.leadId,
        contactId: input.contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AgentError(
        AgentErrorType.LLM_EXECUTION_ERROR,
        `Contact strategy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          tenantId: input.tenantId,
          leadId: input.leadId,
          contactId: input.contactId,
          agentName: this.getAgentName() 
        },
        context?.trace?.id
      );
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async generateEmailContent(
    tenantId: string,
    leadId: string,
    contactId: string,
    options?: AgentExecutionOptions
  ): Promise<ContactStrategyResult> {
    return this.execute({ tenantId, leadId, contactId }, options);
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

  private trackFunctionCalls(context: AgentTracingContext, intermediateSteps: any[]): void {
    intermediateSteps.forEach((step, index) => {
      const toolName = step.action?.tool || 'unknown_tool';
      const toolInput = step.action?.toolInput || {};
      const observation = step.observation || 'No result';

      langfuseService.createEvent(context.trace, {
        name: `tool_call_${toolName}`,
        input: {
          step: index + 1,
          tool: toolName,
          input: toolInput,
        },
        output: {
          observation: observation,
          success: !!observation,
        },
        metadata: {
          toolName,
          stepIndex: index,
          hasResult: !!observation,
        },
      });
    });
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
