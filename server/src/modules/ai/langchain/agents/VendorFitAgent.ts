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
import vendorFitOutputSchema from '../../schemas/vendorFitOutputSchema';
import vendorFitInputSchema from '../../schemas/vendorFitInputSchema';
import { getContentFromMessage } from '../utils/messageUtils';

export type VendorFitResult = {
  finalResponse: string;
  finalResponseParsed: z.infer<typeof vendorFitOutputSchema>;
  totalIterations: number;
  functionCalls: any[];
  traceId?: string;
};

export interface VendorFitOptions {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  enableTracing?: boolean;
  metadata?: Record<string, any>;
}

export class VendorFitAgent {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    this.config = config;
    const model = createInstrumentedChatModel('VendorFitAgent', {}, config);

    const tools: DynamicStructuredTool[] = [
      ListDomainPagesTool,
      GetInformationAboutDomainTool,
      RetrieveFullPageTool,
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '{system_prompt}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const agent = createToolCallingAgent({
      llm: model,
      tools,
      prompt,
    });

    this.agent = new AgentExecutor({
      agent,
      tools,
      maxIterations: config.maxIterations,
      verbose: false,
      returnIntermediateSteps: true,
    });
  }

  async analyzeVendorFit(
    partnerInfo: any,
    opportunityContext: string,
    options: VendorFitOptions = {}
  ): Promise<VendorFitResult> {
    const {
      tenantId,
      userId,
      sessionId = `vendor_fit_${Date.now()}`,
      enableTracing = true,
      metadata = {},
    } = options;

    // Create trace for this analysis
    let trace = null;
    let traceId: string | undefined;

    if (enableTracing && langfuseService.isReady()) {
      trace = langfuseService.createTrace(`Vendor Fit Analysis`, {
        tenantId,
        userId,
        sessionId,
        agentType: 'VendorFitAgent',
        metadata: { partnerDomain: partnerInfo?.domain, ...metadata },
      });
      traceId = trace?.id;
    }
    try {
      // Get prompt (try remote first, fallback to local)
      const { prompt: systemPromptTemplate } = await promptService.getPrompt('vendor_fit', {
        useRemote: true,
        fallbackToLocal: true,
      });

      const systemPrompt = promptHelper.injectInputVariables(systemPromptTemplate, {
        input_schema: JSON.stringify(z.toJSONSchema(vendorFitInputSchema), null, 2),
        partner_details: JSON.stringify(partnerInfo, null, 2),
        opportunity_details: opportunityContext,
        output_schema: JSON.stringify(z.toJSONSchema(vendorFitOutputSchema), null, 2),
      });

      // Log analysis start
      langfuseService.logEvent('vendor_fit_started', {
        partnerDomain: partnerInfo?.domain,
        opportunityContext: opportunityContext?.substring(0, 200),
      }, {
        tenantId,
        userId,
        sessionId,
        agentType: 'VendorFitAgent',
        metadata,
      });

      const result = await this.agent.invoke({
        input: {
          partner_details: partnerInfo,
          opportunity_details: opportunityContext,
        },
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.summarizePartialSteps(result, systemPrompt, {
          tenantId,
          userId,
          sessionId,
        });
      }

      const finalResponseParsed = parseWithSchema(finalResponse, partnerInfo);

      // Log successful completion
      langfuseService.logEvent('vendor_fit_completed', {
        partnerDomain: partnerInfo?.domain,
        totalIterations: result.intermediateSteps?.length ?? 0,
        success: true,
      }, {
        tenantId,
        userId,
        sessionId,
        agentType: 'VendorFitAgent',
        metadata,
      });

      // Score the analysis if we have a trace
      if (trace && finalResponseParsed) {
        langfuseService.score(trace.id, 'vendor_fit_quality', 0.8, 'Vendor fit analysis completed successfully');
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
      langfuseService.logEvent('vendor_fit_error', {
        partnerDomain: partnerInfo?.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, {
        tenantId,
        userId,
        sessionId,
        agentType: 'VendorFitAgent',
        metadata,
      });

      // Score the error if we have a trace
      if (trace) {
        langfuseService.score(trace.id, 'vendor_fit_quality', 0.1, `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      logger.error('Error in vendor fit analysis:', error);
      return {
        finalResponse: `Error occurred during vendor fit analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: getFallbackResult(partnerInfo, error),
        traceId,
      };
    } finally {
      // Flush events
      await langfuseService.flush();
    }
  }

  private async summarizePartialSteps(
    result: any,
    systemPrompt: string,
    tracingMetadata?: Pick<TracingMetadata, 'tenantId' | 'userId' | 'sessionId'>
  ): Promise<string> {
    const structuredModel = createInstrumentedChatModel(
      'VendorFitAgent_Summarizer',
      tracingMetadata || {},
      { model: this.config.model }
    ).withStructuredOutput(z.toJSONSchema(vendorFitOutputSchema));

    const gatheredInfo = (result.intermediateSteps || [])
      .map((step: any) => {
        return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${
          step.observation || 'No result'
        }\n`;
      })
      .join('\n---\n');

    const summaryPrompt = `
You are a vendor fit analysis expert. Based on the partial research conducted below, provide a comprehensive vendor fit analysis between the Partner and Opportunity.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even though the research may be incomplete, provide the best possible vendor fit analysis based on the available information. Focus on what you were able to discover and clearly indicate areas where more research would be beneficial.
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
function parseWithSchema(content: string, partnerInfo: any) {
  try {
    // Remove markdown code fencing and whitespace if present
    const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
    return vendorFitOutputSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    logger.warn('Parsing failed, returning fallback.', error);
    return getFallbackResult(partnerInfo, error);
  }
}

function getFallbackResult(partnerInfo: any, error: unknown) {
  return {
    headline: 'Analysis Unavailable',
    subHeadline: 'Unable to complete vendor fit analysis',
    summary: `An error occurred while analyzing the vendor fit for ${partnerInfo.domain}: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`,
    partnerProducts: partnerInfo.products || [],
    partnerServices: partnerInfo.services || [],
    keyDifferentiators: partnerInfo.differentiators || [],
    marketAlignment: partnerInfo.targetMarket || 'Unknown',
    brandToneMatch: partnerInfo.tone || 'Unknown',
    cta: 'Please contact support for assistance with this analysis.',
  };
}
