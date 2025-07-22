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
      const basePrompt = promptHelper.injectInputVariables(leadQualificationPrompt, {
        lead_details: JSON.stringify(safeInput.leadDetails, null, 2),
        contact_details: JSON.stringify(safeInput.contactDetails, null, 2),
        partner_details: JSON.stringify(safeInput.partnerDetails, null, 2),
        partner_products: JSON.stringify(safeInput.partnerProducts, null, 2),
        output_schema: JSON.stringify(z.toJSONSchema(leadQualificationOutputSchema), null, 2),
      });

      // Add explicit JSON mode instruction
      systemPrompt = `${basePrompt}\n\nIMPORTANT: You must respond with valid JSON only. Start with { and end with }. Do not include any other text.`;
    } catch (error) {
      logger.error('Error preparing prompt variables', error);
      throw new Error(
        `Failed to prepare prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    try {
      const result = await this.agent.invoke({
        input: `Analyze lead qualification for contact: ${safeInput.contactDetails.name || 'Unknown'} at company: ${safeInput.leadDetails.name || 'Unknown'}`,
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      // If agent didn't provide a direct response, try to generate from steps
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.generateSummaryFromSteps(input, result, systemPrompt);
      }

      // If we still don't have a response, try direct model call with structured output
      if (!finalResponse || finalResponse.length < 50) {
        logger.warn('Agent did not provide sufficient response, trying direct model approach');
        finalResponse = await this.tryDirectModelApproach(systemPrompt);
      }

      // Enhanced JSON parsing with better error handling
      const parsedResult = parseWithSchema(finalResponse, input.leadDetails, input.contactDetails);

      return {
        finalResponse: result.output || finalResponse || 'Lead qualification completed',
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

  private async tryDirectModelApproach(systemPrompt: string): Promise<string> {
    try {
      // Create a direct model instance for structured output
      const model = createChatModel(this.config);

      // Try using withStructuredOutput if available
      const structuredModel = model.withStructuredOutput(leadQualificationOutputSchema);

      const response = await structuredModel.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: 'Please provide the lead qualification analysis in the specified JSON format.',
        },
      ]);

      return JSON.stringify(response, null, 2);
    } catch (error) {
      logger.warn(
        'Direct model approach with structured output failed, falling back to text approach',
        error
      );

      // Fallback to regular model call
      const model = createChatModel(this.config);
      const response = await model.invoke([
        { role: 'system', content: systemPrompt + '\n\nRESPOND WITH VALID JSON ONLY.' },
        { role: 'user', content: 'Please provide the lead qualification analysis in JSON format.' },
      ]);

      return response.content as string;
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
    logger.info('Attempting to parse lead qualification JSON', {
      contentLength: content.length,
      extractedLength: jsonText.length,
      preview: jsonText.substring(0, 200) + (jsonText.length > 200 ? '...' : ''),
    });

    const parsed = JSON.parse(jsonText);
    return leadQualificationOutputSchema.parse(parsed);
  } catch (parseError) {
    logger.warn('Lead qualification JSON parsing failed', {
      error: parseError instanceof Error ? parseError.message : 'Unknown error',
      contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      contentLength: content.length,
    });

    // Try to extract individual fields if JSON parsing completely fails
    try {
      return extractFieldsFromText(leadDetails, contactDetails);
    } catch (fallbackError) {
      logger.error('Fallback extraction also failed', fallbackError);
      return getFallbackResult(leadDetails, contactDetails, parseError);
    }
  }
}

function extractFieldsFromText(leadDetails: any, contactDetails: any): LeadQualificationOutput {
  // Simple fallback - look for key patterns in text
  logger.info('Attempting text-based field extraction for lead qualification');

  return getFallbackResult(
    leadDetails,
    contactDetails,
    new Error('JSON parsing failed, used text extraction')
  );
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
