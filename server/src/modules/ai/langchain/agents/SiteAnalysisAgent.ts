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
} from '../../observability';

export type SiteAnalysisResult = EnhancedAgentResult<z.infer<typeof reportOutputSchema>>;

/**
 * LangFuse-First Site Analysis Agent
 *
 * Features:
 * - Required LangFuse observability (no fallbacks)
 * - LangFuse-managed prompts only
 * - Full tracing and performance monitoring
 * - Enhanced error handling with trace context
 * - Clean, modern API design
 */
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

  /**
   * Analyze a website domain with full LangFuse observability
   *
   * @param domain - The domain to analyze
   * @param options - Execution options including tracing context
   * @returns Enhanced analysis result with trace information
   * @throws Error if observability services are not available
   */
  async analyze(domain: string, options: AgentExecutionOptions): Promise<SiteAnalysisResult> {
    const startTime = Date.now();

    // Require observability services - fail fast if not available
    const observabilityServices = await getObservabilityServices();

    if (!observabilityServices.langfuseService.isAvailable()) {
      throw new Error(
        'LangFuse service is not available. Site analysis requires observability services. ' +
          'Please check your LangFuse configuration.'
      );
    }

    // Create trace - required for all executions
    const traceResult = observabilityServices.langfuseService.createTrace(
      'site-analysis',
      { domain },
      {
        agentName: 'SiteAnalysisAgent',
        agentVersion: '2.0.0-langfuse-first',
        tenantId: options.tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
        ...options.metadata,
      }
    );

    const trace = traceResult.trace;
    if (!trace) {
      throw new Error('Failed to create LangFuse trace for site analysis');
    }

    try {
      logger.info('Site analysis started with LangFuse tracing', {
        domain,
        traceId: traceResult.traceId,
        tenantId: options.tenantId,
      });

      // Get prompt from LangFuse - required, no fallbacks
      const promptResult = await observabilityServices.promptService.getPromptWithVariables(
        'summarize_site',
        { domain }
      );

      // Log prompt retrieval
      observabilityServices.langfuseService.logEvent(
        trace,
        'prompt-retrieved',
        { promptName: 'summarize_site', domain },
        {
          version: promptResult.version,
          type: promptResult.metadata?.type,
        }
      );

      // Log agent execution start
      observabilityServices.langfuseService.logEvent(trace, 'agent-execution-start', {
        domain,
        systemPromptLength: promptResult.prompt.length,
        maxIterations: this.config.maxIterations,
      });

      // Execute the agent
      const result = await this.agent.invoke({
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
          domain,
          promptResult.prompt,
          trace,
          observabilityServices
        );
      }

      // Parse the final result
      const finalResponseParsed = this.parseWithSchema(finalResponse, domain);
      const executionTimeMs = Date.now() - startTime;

      // Log successful completion
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

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
        traceId: traceResult.traceId,
        metadata: {
          executionTimeMs,
          agentMetadata: {
            domain,
            promptVersion: promptResult.version,
            promptType: promptResult.metadata?.type,
          },
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      logger.error('Site analysis failed', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        traceId: traceResult.traceId,
      });

      // Log error to trace
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

      // Enhanced error with trace context
      const enhancedError = new Error(
        `Site analysis failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      (enhancedError as any).traceId = traceResult.traceId;
      (enhancedError as any).metadata = {
        executionTimeMs,
        domain,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            phase: 'agent-execution',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      throw enhancedError;
    }
  }

  private async summarizePartialSteps(
    result: any,
    domain: string,
    systemPrompt: string,
    trace: any,
    observabilityServices: any
  ): Promise<string> {
    const span = observabilityServices.langfuseService.createSpan(trace, 'partial-steps-summary', {
      domain,
      intermediateStepsCount: result.intermediateSteps?.length ?? 0,
    });

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

  private parseWithSchema(content: string, domain: string) {
    try {
      // Remove markdown code fencing and whitespace if present
      const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
      return reportOutputSchema.parse(JSON.parse(jsonText));
    } catch (error) {
      logger.error('Site analysis JSON parsing failed', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        contentPreview: content.substring(0, 200),
      });

      throw new Error(
        `Failed to parse site analysis results for ${domain}: ${
          error instanceof Error ? error.message : 'Unknown parsing error'
        }`
      );
    }
  }
}
