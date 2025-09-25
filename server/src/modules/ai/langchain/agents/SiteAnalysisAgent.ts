import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@/libs/logger';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { createLangfuseClient } from '../config/langfuse.config';
import { promptManager } from '../prompts/promptManager';
import { evaluationService } from '../evaluations/evaluationService';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import reportOutputSchema from '../../schemas/reportOutputSchema';
import { getContentFromMessage } from '../utils/messageUtils';

export type SiteAnalysisResult = {
  finalResponse: string;
  finalResponseParsed: z.infer<typeof reportOutputSchema>;
  totalIterations: number;
  functionCalls: any[];
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

  async analyze(domain: string): Promise<SiteAnalysisResult> {
    const outputSchemaJson = JSON.stringify(z.toJSONSchema(reportOutputSchema), null, 2);
    const systemPrompt = await promptManager.getPrompt('summarize_site', {
      domain,
      output_schema: outputSchemaJson,
    });

    const langfuseClient = createLangfuseClient();

    // Start LangFuse trace
    const trace = langfuseClient?.trace({
      name: 'site-analysis',
      input: {
        domain,
        prompt: systemPrompt,
      },
      metadata: {
        agent: 'SiteAnalysisAgent',
        model: this.config.model,
      },
    });

    const span = trace?.span({
      name: 'site-analysis-execution',
      input: {
        domain,
        systemPrompt: systemPrompt.substring(0, 1000), // Truncate for readability
      },
    });

    try {
      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        const partialSpan = span?.span({
          name: 'partial-results-summary',
          input: { domain, steps: result.intermediateSteps.length },
        });

        finalResponse = await this.summarizePartialSteps(result, domain, systemPrompt);

        partialSpan?.end({
          output: { finalResponse: finalResponse.substring(0, 500) },
        });
      }

      const finalResponseParsed = parseWithSchema(finalResponse, domain);

      // Run evaluation
      const evaluation = await evaluationService.evaluateSiteAnalysis(
        domain,
        {}, // No expected output for basic evaluation
        finalResponseParsed
      );

      // End span with success and evaluation
      span?.end({
        output: {
          success: true,
          iterations: result.intermediateSteps?.length ?? 0,
          summaryLength: finalResponseParsed.summary.length,
          productsCount: finalResponseParsed.products.length,
          servicesCount: finalResponseParsed.services.length,
          evaluationScore: evaluation.evaluation.score,
        },
      });

      // Log final results to trace
      trace?.event({
        name: 'analysis-complete',
        input: {
          domain,
        },
        output: {
          success: true,
          summary: finalResponseParsed.summary.substring(0, 200),
          evaluationScore: evaluation.evaluation.score,
          evaluationFeedback: evaluation.evaluation.feedback.substring(0, 100),
        },
        metadata: {
          type: 'analysis-complete',
        },
      });

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
      };
    } catch (error) {
      logger.error('Error in site analysis:', error);

      // Run evaluation even on error
      const evaluation = await evaluationService.evaluateSiteAnalysis(
        domain,
        {},
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );

      // End span with error and evaluation
      span?.end({
        output: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          evaluationScore: evaluation.evaluation.score,
        },
      });

      // Log error to trace
      trace?.event({
        name: 'analysis-error',
        input: {
          domain,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        output: {
          success: false,
          evaluationScore: evaluation.evaluation.score,
          evaluationFeedback: evaluation.evaluation.feedback.substring(0, 100),
        },
        metadata: {
          type: 'analysis-error',
        },
      });

      return {
        finalResponse: `Error occurred during site analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: getFallbackResult(domain, error),
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
