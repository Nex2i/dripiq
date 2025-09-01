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
import reportOutputSchema from '../../schemas/reportOutputSchema';
import { getContentFromMessage } from '../utils/messageUtils';
import { ConversationStorageService } from '../storage/ConversationStorageService';

export type SiteAnalysisResult = {
  finalResponse: string;
  finalResponseParsed: z.infer<typeof reportOutputSchema>;
  totalIterations: number;
  functionCalls: any[];
  conversationId?: string;
};

export class SiteAnalysisAgent {
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

  async analyze(domain: string, tenantId?: string, leadId?: string): Promise<SiteAnalysisResult> {
    const startTime = Date.now();
    const conversationId = ConversationStorageService.generateConversationId();

    const outputSchemaJson = JSON.stringify(z.toJSONSchema(reportOutputSchema), null, 2);
    const systemPrompt = promptHelper.getPromptAndInject('summarize_site', {
      domain,
      output_schema: outputSchemaJson,
    });

    // Create conversation metadata
    const conversationMetadata = ConversationStorageService.createConversationMetadata(
      'site-analysis',
      tenantId || 'unknown',
      { domain, leadId },
      conversationId
    );

    try {
      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.summarizePartialSteps(result, domain, systemPrompt);
      }

      const finalResponseParsed = parseWithSchema(finalResponse, domain);

      // Create enhanced result with parsed data
      const enhancedResult = {
        ...result,
        finalResponseParsed,
      };

      // Save conversation asynchronously
      if (tenantId) {
        const conversationOutput = ConversationStorageService.createConversationOutput(
          conversationMetadata,
          systemPrompt,
          enhancedResult,
          startTime
        );
        ConversationStorageService.saveConversationAsync('site-analysis', conversationOutput);
      }

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
        conversationId,
      };
    } catch (error) {
      logger.error('Error in site analysis:', error);

      // Save error conversation asynchronously
      if (tenantId) {
        const conversationOutput = ConversationStorageService.createConversationOutput(
          conversationMetadata,
          systemPrompt,
          { intermediateSteps: [], output: '' },
          startTime,
          error as Error
        );
        ConversationStorageService.saveConversationAsync('site-analysis', conversationOutput);
      }

      return {
        finalResponse: `Error occurred during site analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: getFallbackResult(domain, error),
        conversationId,
      };
    }
  }

  private async summarizePartialSteps(
    result: any,
    domain: string,
    systemPrompt: string
  ): Promise<string> {
    const structuredModel = createChatModel({
      model: this.config.model,
    }).withStructuredOutput(z.toJSONSchema(reportOutputSchema));

    const gatheredInfo = (result.intermediateSteps || [])
      .map((step: any) => {
        return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${
          step.observation || 'No result'
        }\n`;
      })
      .join('\n---\n');

    const summaryPrompt = `
You are a website analysis expert. Based on the partial research conducted below, provide a comprehensive website analysis for ${domain}.
Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even though the research may be incomplete, provide the best possible analysis based on the available information.
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
function parseWithSchema(content: string, domain: string) {
  try {
    // Remove markdown code fencing and whitespace if present
    const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
    return reportOutputSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    logger.warn('Parsing failed, returning fallback.', error);
    return getFallbackResult(domain, error);
  }
}

function getFallbackResult(domain: string, error: unknown) {
  return {
    summary: `Unable to analyze website ${domain} due to an error: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`,
    products: [],
    services: [],
    differentiators: [],
    targetMarket: 'Unknown',
    tone: 'Unknown',
  };
}
