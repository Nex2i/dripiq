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
import contactExtractionOutputSchema, { ContactExtractionOutput } from '../../schemas/contactExtractionSchema';
import extractContactsPrompt from '@/prompts/extractContacts.prompt';
import { getContentFromMessage } from '../utils/messageUtils';

export type ContactExtractionResult = {
  finalResponse: string;
  finalResponseParsed: ContactExtractionOutput;
  totalIterations: number;
  functionCalls: any[];
};

export class ContactExtractionAgent {
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
    });
  }

  async extractContacts(domain: string): Promise<ContactExtractionResult> {
    try {
      logger.debug(`Starting contact extraction for domain: ${domain}`);

      const systemPrompt = promptHelper.injectInputVariables(extractContactsPrompt, {
        domain,
        output_schema: JSON.stringify(z.toJSONSchema(contactExtractionOutputSchema), null, 2),
      });

      const result = await this.agent.invoke({
        input: `Extract comprehensive contact information from ${domain}. Focus on finding both individual contacts (named people) and office/department contacts. Use all available tools to search multiple pages including contact pages, about us, team pages, and office locations.`,
        system_prompt: systemPrompt,
      });

      const functionCalls = (result.intermediateSteps || []).map((step: any) => ({
        tool: step.action?.tool || 'unknown',
        input: step.action?.toolInput || {},
        output: step.observation || 'No result',
      }));

      logger.debug(`Contact extraction completed for ${domain} in ${functionCalls.length} steps`);

      let parsedResult: ContactExtractionOutput;
      
      if (result.output) {
        parsedResult = parseWithSchema(result.output, domain);
      } else {
        // If no result, try to generate summary from intermediate steps
        const summaryResult = await this.generateSummaryFromSteps(domain, result, systemPrompt);
        parsedResult = parseWithSchema(summaryResult, domain);
      }

      return {
        finalResponse: result.output || 'Contact extraction completed',
        finalResponseParsed: parsedResult,
        totalIterations: functionCalls.length,
        functionCalls,
      };
    } catch (error) {
      logger.error('Contact extraction failed:', error);
      
      // Return fallback result
      const fallbackResult = getFallbackResult(domain, error);
      return {
        finalResponse: `Contact extraction failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        finalResponseParsed: fallbackResult,
        totalIterations: 0,
        functionCalls: [],
      };
    }
  }

  private async generateSummaryFromSteps(
    domain: string,
    result: any,
    systemPrompt: string
  ): Promise<string> {
    const structuredModel = createChatModel({
      model: this.config.model,
    }).withStructuredOutput(z.toJSONSchema(contactExtractionOutputSchema));

    const gatheredInfo = (result.intermediateSteps || [])
      .map((step: any) => {
        return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${
          step.observation || 'No result'
        }\n`;
      })
      .join('\n---\n');

    const summaryPrompt = `
You are a contact extraction expert. Based on the research conducted below, extract all available contact information for ${domain}.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even if the research is incomplete, extract all available contact information based on what was found.
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
function parseWithSchema(content: string, domain: string): ContactExtractionOutput {
  try {
    // Remove markdown code fencing and whitespace if present
    const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
    return contactExtractionOutputSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    logger.warn('Contact extraction parsing failed, returning fallback.', error);
    return getFallbackResult(domain, error);
  }
}

function getFallbackResult(domain: string, error: unknown): ContactExtractionOutput {
  return {
    contacts: [],
    summary: `Unable to extract contacts from ${domain} due to an error: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`,
  };
}