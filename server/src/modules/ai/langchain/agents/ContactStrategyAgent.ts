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
import contactStrategyOutputSchema, {
  OutreachStrategyOutput,
  contactStrategyInputSchema,
  ContactStrategyInput as TypedContactStrategyInput,
} from '../../schemas/contactStrategyOutputSchema';
import { getContentFromMessage } from '../utils/messageUtils';

export type ContactStrategyResult = {
  finalResponse: string;
  finalResponseParsed: OutreachStrategyOutput;
  totalIterations: number;
  functionCalls: any[];
};

export interface ContactStrategyInput {
  leadDetails: any;
  contactDetails: any;
  partnerDetails: any;
  partnerProducts: any[];
  salesman: any;
}

// Updated interface with proper typing - using the exported type from schemas
export type ContactStrategyInputTyped = TypedContactStrategyInput;

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

  async generateContactStrategy(input: ContactStrategyInput): Promise<ContactStrategyResult> {
    // Validate input with Zod schema and provide fallbacks
    let validatedInput: TypedContactStrategyInput | null = null;
    let safeInput: any;

    try {
      validatedInput = contactStrategyInputSchema.parse(input);
      safeInput = validatedInput;
      logger.info('Contact strategy input validation successful');
    } catch (error) {
      logger.warn('Contact strategy input validation failed', {
        error: error instanceof Error ? error.message : 'Unknown validation error',
        input: JSON.stringify(input, null, 2),
      });

      // Use existing safeInput logic with warnings for backward compatibility
      safeInput = {
        leadDetails: input.leadDetails || {},
        contactDetails: input.contactDetails || {},
        partnerDetails: input.partnerDetails || {},
        partnerProducts: input.partnerProducts || [],
        salesman: input.salesman || {},
      };
    }

    let systemPrompt: string;
    try {
      const basePrompt = promptHelper.getPromptAndInject('contact_strategy', {
        lead_details: JSON.stringify(safeInput.leadDetails, null, 2),
        contact_details: JSON.stringify(safeInput.contactDetails, null, 2),
        partner_details: JSON.stringify(safeInput.partnerDetails, null, 2),
        partner_products: JSON.stringify(safeInput.partnerProducts, null, 2),
        salesman: JSON.stringify(safeInput.salesman, null, 2),
        output_schema: JSON.stringify(z.toJSONSchema(contactStrategyOutputSchema), null, 2),
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

  private async tryDirectModelApproach(systemPrompt: string): Promise<string> {
    try {
      // Create a direct model instance for structured output
      const model = createChatModel(this.config);

      // Try using withStructuredOutput if available
      const structuredModel = model.withStructuredOutput(contactStrategyOutputSchema);

      const response = await structuredModel.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: 'Please provide the contact strategy analysis in the specified JSON format.',
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
        { role: 'user', content: 'Please provide the contact strategy analysis in JSON format.' },
      ]);

      return response.content as string;
    }
  }

  private async generateSummaryFromSteps(
    input: ContactStrategyInput,
    result: any,
    systemPrompt: string
  ): Promise<string> {
    const structuredModel = createChatModel({
      model: this.config.model,
    }).withStructuredOutput(z.toJSONSchema(contactStrategyOutputSchema));

    const gatheredInfo = (result.intermediateSteps || [])
      .map((step: any) => {
        return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${
          step.observation || 'No result'
        }\n`;
      })
      .join('\n---\n');

    const summaryPrompt = `
You are a contact strategy expert. Based on the research conducted below, provide a comprehensive contact strategy and outreach plan for the contact at ${input.leadDetails.name}.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even if the research is incomplete, provide the best possible contact strategy analysis and outreach plan based on what was found.
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
    return contactStrategyOutputSchema.parse(parsed);
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
