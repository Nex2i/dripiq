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
import vendorFitOutputSchema from '../../schemas/vendorFitOutputSchema';
import vendorFitInputSchema from '../../schemas/vendorFitInputSchema';
import { getContentFromMessage } from '../utils/messageUtils';
import {
  getObservabilityServices,
  type EnhancedAgentResult,
  type AgentExecutionOptions,
} from '../../observability';

export type VendorFitResult = EnhancedAgentResult<z.infer<typeof vendorFitOutputSchema>>;

export class VendorFitAgent {
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
    options: AgentExecutionOptions = {}
  ): Promise<VendorFitResult> {
    const startTime = Date.now();
    let trace: any = null;
    let observabilityServices: any = null;

    try {
      // Try to initialize observability services if tracing is enabled
      if (options.enableTracing !== false) {
        try {
          observabilityServices = await getObservabilityServices();
        } catch (error) {
          logger.debug('Observability services not available - continuing without tracing', {
            partnerDomain: partnerInfo?.domain,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Create trace if observability is available
      if (observabilityServices?.langfuseService?.isAvailable()) {
        const traceResult = observabilityServices.langfuseService.createTrace(
          'vendor-fit-analysis',
          { 
            partnerInfo: partnerInfo?.domain || 'unknown',
            opportunityContext: opportunityContext.substring(0, 100) + '...',
          },
          {
            agentName: 'VendorFitAgent',
            agentVersion: '1.0.0-enhanced',
            input: { partnerInfo, opportunityContext },
            tenantId: options.tenantId,
            userId: options.userId,
            sessionId: options.sessionId,
            custom: options.metadata,
          }
        );
        trace = traceResult.trace;
      }

      // Get prompt (fallback to old system if observability not available)
      let systemPrompt: string;
      try {
        if (observabilityServices?.promptService) {
          const promptResult = await observabilityServices.promptService.getPromptWithVariables(
            'vendor_fit',
            {
              partner_details: JSON.stringify(partnerInfo, null, 2),
              opportunity_details: opportunityContext,
            },
            { cacheTtlSeconds: options.promptCacheTtl }
          );
          systemPrompt = promptResult.prompt;
        } else {
          // Fallback to old prompt system
          systemPrompt = promptHelper.getPromptAndInject('vendor_fit', {
            input_schema: JSON.stringify(z.toJSONSchema(vendorFitInputSchema), null, 2),
            partner_details: JSON.stringify(partnerInfo, null, 2),
            opportunity_details: opportunityContext,
            output_schema: JSON.stringify(z.toJSONSchema(vendorFitOutputSchema), null, 2),
          });
        }
      } catch (error) {
        logger.warn('Failed to get prompt from observability system, using fallback', { error });
        // Fallback to old prompt system
        systemPrompt = promptHelper.getPromptAndInject('vendor_fit', {
          input_schema: JSON.stringify(z.toJSONSchema(vendorFitInputSchema), null, 2),
          partner_details: JSON.stringify(partnerInfo, null, 2),
          opportunity_details: opportunityContext,
          output_schema: JSON.stringify(z.toJSONSchema(vendorFitOutputSchema), null, 2),
        });
      }

      const result = await this.agent.invoke({
        input: {
          partner_details: partnerInfo,
          opportunity_details: opportunityContext,
        },
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.summarizePartialSteps(result, systemPrompt);
      }

      const finalResponseParsed = parseWithSchema(finalResponse, partnerInfo);
      const executionTimeMs = Date.now() - startTime;

      // Update trace with success
      if (trace) {
        observabilityServices.langfuseService.updateTrace(
          trace,
          { finalResponse: finalResponseParsed, executionTimeMs },
          { success: true, partnerDomain: partnerInfo?.domain }
        );
      }

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
        traceId: trace?.id || null,
        metadata: {
          executionTimeMs,
          agentMetadata: { 
            partnerDomain: partnerInfo?.domain,
            opportunityLength: opportunityContext.length,
          },
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      logger.error('Error in vendor fit analysis:', error);

      // Log error to trace
      if (trace && observabilityServices) {
        observabilityServices.langfuseService.logError(trace, error as Error, {
          phase: 'agent-execution',
          partnerDomain: partnerInfo?.domain,
        });
        observabilityServices.langfuseService.updateTrace(
          trace,
          null,
          { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }

      return {
        finalResponse: `Error occurred during vendor fit analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: getFallbackResult(partnerInfo, error),
        traceId: trace?.id || null,
        metadata: {
          executionTimeMs,
          errors: [{
            message: error instanceof Error ? error.message : 'Unknown error',
            phase: 'agent-execution',
            timestamp: new Date().toISOString(),
          }],
        },
      };
    }
  }

  private async summarizePartialSteps(result: any, systemPrompt: string): Promise<string> {
    const structuredModel = createChatModel({
      model: this.config.model,
    }).withStructuredOutput(z.toJSONSchema(vendorFitOutputSchema));

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
