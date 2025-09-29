import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@/libs/logger';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import vendorFitOutputSchema from '../../schemas/vendorFitOutputSchema';
import { getContentFromMessage } from '../utils/messageUtils';
import {
  getObservabilityServices,
  type EnhancedAgentResult,
  type AgentExecutionOptions,
} from '../../observability';

export type VendorFitResult = EnhancedAgentResult<z.infer<typeof vendorFitOutputSchema>>;

/**
 * LangFuse-First Vendor Fit Analysis Agent
 *
 * Features:
 * - Required LangFuse observability (no fallbacks)
 * - LangFuse-managed prompts only
 * - Full tracing and performance monitoring
 * - Enhanced error handling with trace context
 * - Clean, modern API design
 */
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

  /**
   * Analyze vendor fit between partner and opportunity with full LangFuse observability
   *
   * @param partnerInfo - Information about the partner organization
   * @param opportunityContext - Context about the opportunity
   * @param options - Execution options including tracing context
   * @returns Enhanced vendor fit analysis result with trace information
   * @throws Error if observability services are not available
   */
  async analyzeVendorFit(
    partnerInfo: any,
    opportunityContext: string,
    options: AgentExecutionOptions
  ): Promise<VendorFitResult> {
    const startTime = Date.now();

    // Require observability services - fail fast if not available
    const observabilityServices = await getObservabilityServices();

    if (!observabilityServices.langfuseService.isAvailable()) {
      throw new Error(
        'LangFuse service is not available. Vendor fit analysis requires observability services. ' +
          'Please check your LangFuse configuration.'
      );
    }

    // Create trace - required for all executions
    const traceResult = observabilityServices.langfuseService.createTrace(
      'vendor-fit-analysis',
      {
        partnerDomain: partnerInfo?.domain || 'unknown',
        opportunityLength: opportunityContext.length,
      },
      {
        agentName: 'VendorFitAgent',
        agentVersion: '2.0.0-langfuse-first',
        tenantId: options.tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
        ...options.metadata,
      }
    );

    const trace = traceResult.trace;
    if (!trace) {
      throw new Error('Failed to create LangFuse trace for vendor fit analysis');
    }

    try {
      logger.info('Vendor fit analysis started with LangFuse tracing', {
        partnerDomain: partnerInfo?.domain,
        traceId: traceResult.traceId,
        tenantId: options.tenantId,
      });

      // Get prompt from LangFuse - required, no fallbacks
      const promptResult = await observabilityServices.promptService.getPromptWithVariables(
        'vendor_fit',
        {
          partner_details: JSON.stringify(partnerInfo, null, 2),
          opportunity_details: opportunityContext,
        },
        { cacheTtlSeconds: options.promptCacheTtl }
      );

      // Log prompt retrieval and input data
      observabilityServices.langfuseService.logEvent(
        trace,
        'prompt-retrieved',
        {
          promptName: 'vendor_fit',
          partnerDomain: partnerInfo?.domain,
          opportunityLength: opportunityContext.length,
        },
        {
          cached: promptResult.cached,
          version: promptResult.version,
          source: promptResult.metadata?.source,
        }
      );

      // Log analysis start
      observabilityServices.langfuseService.logEvent(trace, 'vendor-fit-analysis-start', {
        partnerDomain: partnerInfo?.domain,
        systemPromptLength: promptResult.prompt.length,
        maxIterations: this.config.maxIterations,
      });

      // Execute the agent
      const result = await this.agent.invoke({
        input: {
          partner_details: partnerInfo,
          opportunity_details: opportunityContext,
        },
        system_prompt: promptResult.prompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      // Handle partial results if needed
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        observabilityServices.langfuseService.logEvent(trace, 'partial-result-handling', {
          intermediateStepsCount: result.intermediateSteps.length,
        });

        finalResponse = await this.summarizePartialSteps(
          result,
          promptResult.prompt,
          trace,
          observabilityServices
        );
      }

      // Parse the final result
      const finalResponseParsed = this.parseWithSchema(finalResponse, partnerInfo);
      const executionTimeMs = Date.now() - startTime;

      // Log successful completion
      observabilityServices.langfuseService.logEvent(
        trace,
        'vendor-fit-analysis-complete',
        {
          partnerDomain: partnerInfo?.domain,
          totalIterations: result.intermediateSteps?.length ?? 0,
          executionTimeMs,
        },
        {
          success: true,
          finalResponseLength: finalResponse.length,
          parsedSuccessfully: true,
        }
      );

      // Update the trace with final results
      observabilityServices.langfuseService.updateTrace(
        trace,
        {
          finalResponse: finalResponseParsed,
          totalIterations: result.intermediateSteps?.length ?? 0,
          executionTimeMs,
        },
        {
          success: true,
          partnerDomain: partnerInfo?.domain,
        }
      );

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
        traceId: traceResult.traceId,
        metadata: {
          executionTimeMs,
          agentMetadata: {
            partnerDomain: partnerInfo?.domain,
            opportunityLength: opportunityContext.length,
            promptVersion: promptResult.version,
            promptCached: promptResult.cached,
          },
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      logger.error('Vendor fit analysis failed', {
        partnerDomain: partnerInfo?.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        traceId: traceResult.traceId,
      });

      // Log error to trace
      observabilityServices.langfuseService.logError(trace, error as Error, {
        phase: 'vendor-fit-analysis',
        partnerDomain: partnerInfo?.domain,
        executionTimeMs,
      });

      observabilityServices.langfuseService.updateTrace(trace, null, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        partnerDomain: partnerInfo?.domain,
        executionTimeMs,
      });

      // Enhanced error with trace context
      const enhancedError = new Error(
        `Vendor fit analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      (enhancedError as any).traceId = traceResult.traceId;
      (enhancedError as any).metadata = {
        executionTimeMs,
        partnerDomain: partnerInfo?.domain,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            phase: 'vendor-fit-analysis',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      throw enhancedError;
    }
  }

  private async summarizePartialSteps(
    result: any,
    systemPrompt: string,
    trace: any,
    observabilityServices: any
  ): Promise<string> {
    const span = observabilityServices.langfuseService.createSpan(trace, 'partial-steps-summary', {
      intermediateStepsCount: result.intermediateSteps?.length ?? 0,
    });

    try {
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

      const summaryResult = getContentFromMessage(summary.content ?? summary);

      if (span) {
        observabilityServices.langfuseService.updateSpan(
          span,
          { summaryLength: summaryResult.length },
          { success: true }
        );
      }

      return summaryResult;
    } catch (error) {
      if (span) {
        observabilityServices.langfuseService.updateSpan(span, null, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  private parseWithSchema(content: string, partnerInfo: any) {
    try {
      // Remove markdown code fencing and whitespace if present
      const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
      return vendorFitOutputSchema.parse(JSON.parse(jsonText));
    } catch (error) {
      logger.error('Vendor fit analysis JSON parsing failed', {
        partnerDomain: partnerInfo?.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        contentPreview: content.substring(0, 200),
      });

      throw new Error(
        `Failed to parse vendor fit analysis results: ${
          error instanceof Error ? error.message : 'Unknown parsing error'
        }`
      );
    }
  }
}
