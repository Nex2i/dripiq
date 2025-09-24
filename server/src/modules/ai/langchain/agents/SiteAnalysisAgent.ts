import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promptHelper } from '@/prompts/prompt.helper';
import { logger } from '@/libs/logger';
import { createInstrumentedChatModel, LangChainConfig } from '../config/langchain.config';
import { langfuseService, TracingMetadata } from '../../observability/langfuse.service';
import { promptService } from '../../observability/prompt.service';
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
  traceId?: string;
};

export interface SiteAnalysisOptions {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  enableTracing?: boolean;
  metadata?: Record<string, any>;
}

export class SiteAnalysisAgent {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    this.config = config;

    // Create instrumented model with basic agent metadata
    const model = createInstrumentedChatModel('SiteAnalysisAgent', {}, config);

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

  async analyze(domain: string, options: SiteAnalysisOptions = {}): Promise<SiteAnalysisResult> {
    const {
      tenantId,
      userId,
      sessionId = `site_analysis_${domain}_${Date.now()}`,
      enableTracing = true,
      metadata = {},
    } = options;

    // Create trace for this analysis
    let trace = null;
    let traceId: string | undefined;

    if (enableTracing && langfuseService.isReady()) {
      trace = langfuseService.createTrace(`Site Analysis: ${domain}`, {
        tenantId,
        userId,
        sessionId,
        agentType: 'SiteAnalysisAgent',
        metadata: { domain, ...metadata },
      });
      traceId = trace?.id;
    }

    try {
      // Get prompt (try remote first, fallback to local)
      const { prompt: systemPromptTemplate } = await promptService.getPrompt('summarize_site', {
        useRemote: true,
        fallbackToLocal: true,
      });

      const outputSchemaJson = JSON.stringify(z.toJSONSchema(reportOutputSchema), null, 2);
      const systemPrompt = promptHelper.injectInputVariables(systemPromptTemplate, {
        domain,
        output_schema: outputSchemaJson,
      });

      // Log analysis start
      langfuseService.logEvent('site_analysis_started', { domain }, {
        tenantId,
        userId,
        sessionId,
        agentType: 'SiteAnalysisAgent',
        metadata,
      });

      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.summarizePartialSteps(result, domain, systemPrompt, {
          tenantId,
          userId,
          sessionId,
        });
      }

      const finalResponseParsed = parseWithSchema(finalResponse, domain);

      // Log successful completion
      langfuseService.logEvent('site_analysis_completed', {
        domain,
        totalIterations: result.intermediateSteps?.length ?? 0,
        success: true,
      }, {
        tenantId,
        userId,
        sessionId,
        agentType: 'SiteAnalysisAgent',
        metadata,
      });

      // Score the analysis if we have a trace
      if (trace && finalResponseParsed) {
        langfuseService.score(trace.id, 'analysis_quality', 0.8, 'Site analysis completed successfully');
      }

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
        traceId,
      };
    } catch (error) {
      // Log error
      langfuseService.logEvent('site_analysis_error', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, {
        tenantId,
        userId,
        sessionId,
        agentType: 'SiteAnalysisAgent',
        metadata,
      });

      // Score the error if we have a trace
      if (trace) {
        langfuseService.score(trace.id, 'analysis_quality', 0.1, `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      logger.error('Error in site analysis:', error);
      return {
        finalResponse: `Error occurred during site analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: getFallbackResult(domain, error),
        traceId,
      };
    } finally {
      // Flush events
      await langfuseService.flush();
    }
  }

  private async summarizePartialSteps(
    result: any,
    domain: string,
    systemPrompt: string,
    tracingMetadata?: Pick<TracingMetadata, 'tenantId' | 'userId' | 'sessionId'>
  ): Promise<string> {
    const structuredModel = createInstrumentedChatModel(
      'SiteAnalysisAgent_Summarizer',
      tracingMetadata || {},
      { model: this.config.model }
    ).withStructuredOutput(z.toJSONSchema(reportOutputSchema));

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
