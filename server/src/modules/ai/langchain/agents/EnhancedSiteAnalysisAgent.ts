import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@/libs/logger';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import reportOutputSchema from '../../schemas/reportOutputSchema';
import { getContentFromMessage } from '../utils/messageUtils';
import {
  getObservabilityServices,
  type EnhancedAgentResult,
  type AgentExecutionOptions,
  type AgentTraceMetadata,
} from '../../observability';

export type SiteAnalysisResult = EnhancedAgentResult<z.infer<typeof reportOutputSchema>>;

/**
 * Enhanced Site Analysis Agent with full LangFuse observability integration
 *
 * Features:
 * - Full LangFuse tracing and observability
 * - LangFuse-first prompt management
 * - Enhanced execution context with metadata
 * - Error tracking and performance metrics
 * - Graceful degradation when observability is unavailable
 */
export class EnhancedSiteAnalysisAgent {
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

  /**
   * Analyze a domain with enhanced observability
   */
  async analyze(domain: string, options: AgentExecutionOptions = {}): Promise<SiteAnalysisResult> {
    const startTime = Date.now();
    let trace: any = null;
    let observabilityServices: any = null;

    try {
      // Initialize observability services
      if (options.enableTracing !== false) {
        try {
          observabilityServices = await getObservabilityServices();
        } catch (error) {
          logger.warn('Observability services not available - continuing without tracing', {
            domain,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Create trace if observability is available
      if (observabilityServices?.langfuseService?.isAvailable()) {
        const traceMetadata: AgentTraceMetadata = {
          agentName: 'SiteAnalysisAgent',
          agentVersion: '2.0.0-enhanced',
          input: { domain },
          tenantId: options.tenantId,
          userId: options.userId,
          sessionId: options.sessionId,
          custom: options.metadata,
        };

        const traceResult = observabilityServices.langfuseService.createTrace(
          'site-analysis',
          { domain },
          traceMetadata
        );
        trace = traceResult.trace;

        logger.info('Site analysis trace created', {
          domain,
          traceId: traceResult.traceId,
          tenantId: options.tenantId,
        });
      }

      // Get prompt from LangFuse/local fallback
      let systemPrompt: string;
      try {
        if (observabilityServices?.promptService) {
          const promptResult = await observabilityServices.promptService.getPromptWithVariables(
            'summarize_site',
            {
              domain,
              // Note: Ignoring output_schema as per requirements
            }
          );
          systemPrompt = promptResult.prompt;

          // Log prompt retrieval event
          if (trace) {
            observabilityServices.langfuseService.logEvent(
              trace,
              'prompt-retrieved',
              { promptName: 'summarize_site' },
              {
                cached: promptResult.cached,
                version: promptResult.version,
                source: promptResult.metadata?.source,
              }
            );
          }
        } else {
          throw new Error('Prompt service not available');
        }
      } catch (error) {
        logger.error('Failed to retrieve prompt, using fallback', { domain, error });
        // Fallback to basic prompt structure
        systemPrompt = `Analyze the website ${domain} and provide a comprehensive summary.`;

        if (trace) {
          observabilityServices.langfuseService.logError(trace, error as Error, {
            phase: 'prompt-retrieval',
            domain,
          });
        }
      }

      // Log agent execution start
      if (trace) {
        observabilityServices.langfuseService.logEvent(trace, 'agent-execution-start', {
          domain,
          systemPromptLength: systemPrompt.length,
          maxIterations: this.config.maxIterations,
        });
      }

      // Execute the agent
      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      // Handle partial results if needed
      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        if (trace) {
          observabilityServices.langfuseService.logEvent(trace, 'partial-result-handling', {
            intermediateStepsCount: result.intermediateSteps.length,
          });
        }

        finalResponse = await this.summarizePartialSteps(
          result,
          domain,
          systemPrompt,
          trace,
          observabilityServices
        );
      }

      // Parse the final result
      const finalResponseParsed = parseWithSchema(finalResponse, domain);

      const executionTimeMs = Date.now() - startTime;

      // Log successful completion
      if (trace) {
        observabilityServices.langfuseService.logEvent(
          trace,
          'agent-execution-complete',
          {
            domain,
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
            domain,
          }
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
            domain,
            promptVersion: 'local-fallback', // Will be dynamic when LangFuse prompts are configured
          },
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      logger.error('Error in enhanced site analysis:', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
      });

      // Log error to trace
      if (trace && observabilityServices) {
        observabilityServices.langfuseService.logError(trace, error as Error, {
          phase: 'agent-execution',
          domain,
          executionTimeMs,
        });

        observabilityServices.langfuseService.updateTrace(trace, null, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          domain,
          executionTimeMs,
        });
      }

      // Return fallback result
      return {
        finalResponse: `Error occurred during site analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: getFallbackResult(domain, error),
        traceId: trace?.id || null,
        metadata: {
          executionTimeMs,
          errors: [
            {
              message: error instanceof Error ? error.message : 'Unknown error',
              phase: 'agent-execution',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      };
    }
  }

  private async summarizePartialSteps(
    result: any,
    domain: string,
    systemPrompt: string,
    trace: any,
    observabilityServices: any
  ): Promise<string> {
    const span = trace
      ? observabilityServices.langfuseService.createSpan(trace, 'partial-steps-summary', {
          domain,
          intermediateStepsCount: result.intermediateSteps?.length ?? 0,
        })
      : null;

    try {
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
