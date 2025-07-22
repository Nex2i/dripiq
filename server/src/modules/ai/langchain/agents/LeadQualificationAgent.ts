import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promptHelper } from '@/prompts/prompt.helper';
import { logger } from '@/libs/logger';
import leadQualificationPrompt from '@/prompts/lead_qualification.prompt';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import leadQualificationOutputSchema, {
  LeadQualificationOutput,
} from '../../schemas/leadQualificationOutputSchema';
import { getContentFromMessage } from '../utils/messageUtils';

export type LeadQualificationResult = {
  finalResponse: string;
  finalResponseParsed: LeadQualificationOutput;
  totalIterations: number;
  functionCalls: any[];
};

export interface LeadQualificationInput {
  leadDetails: any;
  contactDetails: any;
  partnerDetails: any;
  partnerProducts: any[];
}

export class LeadQualificationAgent {
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

  async qualifyLead(input: LeadQualificationInput): Promise<LeadQualificationResult> {
    // Ensure all input properties exist and are serializable
    const safeInput = {
      leadDetails: input.leadDetails || {},
      contactDetails: input.contactDetails || {},
      partnerDetails: input.partnerDetails || {},
      partnerProducts: input.partnerProducts || [],
    };

    let systemPrompt: string;
    try {
      systemPrompt = promptHelper.injectInputVariables(leadQualificationPrompt, {
        lead_details: JSON.stringify(safeInput.leadDetails, null, 2),
        contact_details: JSON.stringify(safeInput.contactDetails, null, 2),
        partner_details: JSON.stringify(safeInput.partnerDetails, null, 2),
        partner_products: JSON.stringify(safeInput.partnerProducts, null, 2),
        output_schema: JSON.stringify(z.toJSONSchema(leadQualificationOutputSchema), null, 2),
      });
    } catch (error) {
      logger.error('Error preparing prompt variables', error);
      throw new Error(
        `Failed to prepare prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    try {
      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.generateSummaryFromSteps(input, result, systemPrompt);
      }

      const parsedResult = parseWithSchema(finalResponse, input.leadDetails, input.contactDetails);

      return {
        finalResponse: result.output || 'Lead qualification completed',
        finalResponseParsed: parsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
      };
    } catch (error) {
      logger.error('Lead qualification failed:', error);

      // Return fallback result
      const fallbackResult = getFallbackResult(input.leadDetails, input.contactDetails, error);
      return {
        finalResponse: `Lead qualification failed for ${input.leadDetails.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        finalResponseParsed: fallbackResult,
        totalIterations: 0,
        functionCalls: [],
      };
    }
  }

  private async generateSummaryFromSteps(
    input: LeadQualificationInput,
    result: any,
    systemPrompt: string
  ): Promise<string> {
    const structuredModel = createChatModel({
      model: this.config.model,
    }).withStructuredOutput(z.toJSONSchema(leadQualificationOutputSchema));

    const gatheredInfo = (result.intermediateSteps || [])
      .map((step: any) => {
        return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${
          step.observation || 'No result'
        }\n`;
      })
      .join('\n---\n');

    const summaryPrompt = `
You are a lead qualification expert. Based on the research conducted below, provide a comprehensive lead qualification and outreach strategy for the contact at ${input.leadDetails.name}.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even if the research is incomplete, provide the best possible qualification analysis and outreach strategy based on what was found.
Return your answer as valid JSON matching the provided schema.
    `;

    const summary = await structuredModel.invoke([
      {
        role: 'system',
        content: summaryPrompt,
      },
    ]);
    return getContentFromMessage(summary.content ?? summary);
  }
}

// -- Helpers --
function parseWithSchema(
  content: string,
  leadDetails: any,
  contactDetails: any
): LeadQualificationOutput {
  try {
    // Remove markdown code fencing and whitespace if present
    const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
    return leadQualificationOutputSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    logger.warn('Lead qualification parsing failed, returning fallback.', error);
    return getFallbackResult(leadDetails, contactDetails, error);
  }
}

function getFallbackResult(
  leadDetails: any,
  contactDetails: any,
  error: unknown
): LeadQualificationOutput {
  return {
    leadResearch: {
      companyBackground: `Unable to complete comprehensive analysis for ${leadDetails.name} due to an error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      recentNews: [],
      industryContext: leadDetails.targetMarket || 'Unknown',
      problemSolutionFit: 'Analysis incomplete due to error',
      priorityScore: 'medium',
      potentialValue: 'Unknown',
    },
    contactAnalysis: {
      contact: {
        name: contactDetails.name || 'Unknown',
        title: contactDetails.title || null,
        persona: 'Unknown',
        painPoints: [],
        professionalGoals: [],
        messagingApproach: 'strategic',
      },
      decisionMakingRole: 'Unknown',
      influenceLevel: 'medium',
      engagementStrategy: 'Standard outreach approach recommended',
    },
    outreachStrategy: {
      dripCampaign: {
        touchpoint1: createFallbackTouchpoint('email', 'Day 1', 'Introduction'),
        touchpoint2: createFallbackTouchpoint('email', 'Day 3', 'Follow-up'),
        touchpoint3: createFallbackTouchpoint('call', 'Day 7', 'Phone outreach'),
        touchpoint4: createFallbackTouchpoint('email', 'Day 10', 'Educational content'),
        touchpoint5: createFallbackTouchpoint('call', 'Day 14', 'Second call attempt'),
        touchpoint6: createFallbackTouchpoint('email', 'Day 21', 'Break-up email'),
      },
      timing: {
        frequency: 'Every 3-4 business days',
        totalDuration: '3 weeks',
      },
      channelMix: ['Email', 'Phone'],
    },
    messaging: {
      valueProposition: 'Analysis incomplete - generic value proposition would be recommended',
      keyBenefits: [],
      caseStudyReferences: [],
      supportingMaterials: [],
      objectionHandling: [],
    },
    nextSteps: {
      immediateActions: ['Review error and retry analysis'],
      followUpSchedule: 'Standard follow-up schedule',
      successMetrics: ['Email open rates', 'Response rates'],
      escalationTriggers: ['No response after 3 touchpoints'],
    },
    summary:
      'Lead qualification analysis could not be completed due to an error. Manual review recommended.',
  };
}

function createFallbackTouchpoint(
  type: 'email' | 'call' | 'linkedin',
  timing: string,
  purpose: string
) {
  return {
    type,
    timing,
    subject: `${purpose} - Generic template`,
    content: 'Generic content template would be provided here',
    callToAction: 'Schedule a brief call',
    notes: 'Manual customization required',
  };
}
