import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promptHelper } from '@/prompts/prompt.helper';
import { logger } from '@/libs/logger';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import {
  OutreachStrategyOutput,
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
  outreachStrategyOutputSchema,
} from '../../schemas/contactStrategySchemas';
import { getContentFromMessage } from '../utils/messageUtils';
import {
  leadPointOfContactRepository,
  leadProductRepository,
  leadRepository,
} from '@/repositories';
import { TenantService } from '@/modules/tenant.service';

export type ContactStrategyResult = {
  finalResponse: string;
  finalResponseParsed: OutreachStrategyOutput;
  totalIterations: number;
  functionCalls: any[];
};

type ValueSchema<T> = {
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
      ['human', `{lead_details}`],
      ['human', `{contact_details}`],
      ['human', `{partner_details}`],
      ['human', `{partner_products}`],
      ['human', `{salesman}`],
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

  async generateContactStrategy(
    tenantId: string,
    leadId: string,
    contactId: string
  ): Promise<ContactStrategyResult> {
    let systemPrompt: string;
    try {
      const basePrompt = promptHelper.getPromptAndInject('contact_strategy', {
        output_schema: JSON.stringify(z.toJSONSchema(outreachStrategyOutputSchema), null, 2),
      });

      // Add explicit JSON mode instruction
      systemPrompt = `${basePrompt}\n\nIMPORTANT: You must respond with valid JSON only.`;
    } catch (error) {
      logger.error('Error preparing prompt variables', error);
      throw new Error(
        `Failed to prepare prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    try {
      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
        lead_details: await this.getLeadDetails(tenantId, leadId),
        contact_details: await this.getContactDetails(contactId),
        partner_details: await this.getPartnerDetails(tenantId),
        partner_products: await this.getPartnerProducts(tenantId, leadId),
        salesman: await this.getSalesman(tenantId, leadId),
      });

      let finalResponse = getContentFromMessage(result.output);

      // If agent didn't provide a direct response, try to generate from steps
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        logger.error('Agent did not provide a direct response, trying direct model approach');
        throw new Error('Agent did not provide a direct response');
      }

      // Enhanced JSON parsing with better error handling
      const parsedResult = parseWithSchema(finalResponse);

      return {
        finalResponse: result.output || finalResponse || 'Contact strategy generation completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
      };
    } catch (error) {
      logger.error('Contact strategy generation failed:', error);

      throw error;
    }
  }

  private async getLeadDetails(
    tenantId: string,
    leadId: string
  ): Promise<ValueSchema<LeadDetails>> {
    const leadDetails = await leadRepository.findByIdForTenant(leadId, tenantId);

    return {
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

    return {
      value: leadProducts.map((product) => ({
        id: product.id,
        title: product.title || '',
        description: product.description || '',
        salesVoice: product.salesVoice || '',
        siteUrl: product.siteUrl || '',
      })),
      schema: z.toJSONSchema(partnerProductSchema),
    };
  }

  private async getSalesman(tenantId: string, leadId: string): Promise<ValueSchema<Salesman>> {
    const lead = await leadRepository.findOwnerForLead(leadId, tenantId);

    return {
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
function parseWithSchema(content: string): OutreachStrategyOutput {
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
    logger.info('Attempting to parse contact strategy JSON', {
      contentLength: content.length,
      extractedLength: jsonText.length,
      preview: jsonText.substring(0, 200) + (jsonText.length > 200 ? '...' : ''),
    });

    const parsed = JSON.parse(jsonText);
    return outreachStrategyOutputSchema.parse(parsed);
  } catch (parseError) {
    logger.warn('Contact strategy JSON parsing failed', {
      error: parseError instanceof Error ? parseError.message : 'Unknown error',
      contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      contentLength: content.length,
    });

    // Try to extract individual fields if JSON parsing completely fails
    throw new Error('Contact strategy JSON parsing failed');
  }
}
