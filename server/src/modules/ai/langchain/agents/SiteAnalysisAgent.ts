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
import { BaseObservableAgent } from '../../observability/base-agent';
import { 
  AgentExecutionOptions, 
  AgentExecutionResult, 
  AgentTracingContext,
  PromptInjectionContext,
  AgentError,
  AgentErrorType 
} from '../../observability/types';
import { langfuseService } from '../../observability/langfuse.service';

export type SiteAnalysisResult = AgentExecutionResult<z.infer<typeof reportOutputSchema>>;

export interface SiteAnalysisInput {
  domain: string;
}

export class SiteAnalysisAgent extends BaseObservableAgent<SiteAnalysisInput, z.infer<typeof reportOutputSchema>> {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    super();
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

  protected getAgentName(): string {
    return 'SiteAnalysisAgent';
  }

  protected getAgentVersion(): string {
    return '2.0.0';
  }

  protected getPromptName(): string {
    return 'summarize_site';
  }

  protected getAgentDescription(): string {
    return 'Analyzes websites to extract comprehensive information about products, services, and company details';
  }

  protected preparePromptContext(input: SiteAnalysisInput): PromptInjectionContext {
    return {
      domain: input.domain,
      variables: {
        domain: input.domain,
        // Note: As per requirements, we're ignoring output_schema injection
      },
    };
  }

  protected async executeCore(
    input: SiteAnalysisInput,
    promptContent: string,
    context: AgentTracingContext
  ): Promise<{
    finalResponse: string;
    finalResponseParsed: z.infer<typeof reportOutputSchema>;
    totalIterations: number;
    functionCalls: any[];
  }> {
    // Create generation for LLM tracking
    const generation = context ? langfuseService.createGeneration(context.trace, {
      name: 'site_analysis_generation',
      model: this.config.model,
      input: {
        domain: input.domain,
        promptLength: promptContent.length,
      },
    }) : null;

    try {
      const result = await this.agent.invoke({
        system_prompt: promptContent,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.summarizePartialSteps(result, input.domain, promptContent, context);
      }

      const finalResponseParsed = parseWithSchema(finalResponse, input.domain);

      // Update generation with success
      if (generation) {
        langfuseService.updateElement(generation, {
          output: {
            success: true,
            responseLength: finalResponse.length,
            iterations: result.intermediateSteps?.length ?? 0,
            functionCalls: result.intermediateSteps?.length ?? 0,
          },
        });
        langfuseService.endElement(generation);
      }

      // Track function calls as events
      if (context && result.intermediateSteps) {
        this.trackFunctionCalls(context, result.intermediateSteps);
      }

      return {
        finalResponse,
        finalResponseParsed,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps ?? [],
      };
    } catch (error) {
      // Update generation with error
      if (generation) {
        langfuseService.updateElement(generation, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(generation);
      }

      // Try fallback analysis
      logger.warn('Site analysis failed, attempting fallback', {
        domain: input.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AgentError(
        AgentErrorType.LLM_EXECUTION_ERROR,
        `Site analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          domain: input.domain,
          agentName: this.getAgentName() 
        },
        context?.trace?.id
      );
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async analyze(domain: string, options?: AgentExecutionOptions): Promise<SiteAnalysisResult> {
    return this.execute({ domain }, options);
  }

  private async summarizePartialSteps(
    result: any,
    domain: string,
    systemPrompt: string,
    context: AgentTracingContext | null
  ): Promise<string> {
    const summarySpan = context ? langfuseService.createSpan(context.trace, {
      name: 'partial_steps_summary',
      metadata: {
        domain,
        stepCount: result.intermediateSteps?.length || 0,
      },
    }) : null;

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

      if (summarySpan) {
        langfuseService.updateElement(summarySpan, {
          output: {
            success: true,
            summaryLength: summaryResult.length,
          },
        });
        langfuseService.endElement(summarySpan);
      }

      return summaryResult;
    } catch (error) {
      if (summarySpan) {
        langfuseService.updateElement(summarySpan, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(summarySpan);
      }

      throw error;
    }
  }

  private trackFunctionCalls(context: AgentTracingContext, intermediateSteps: any[]): void {
    intermediateSteps.forEach((step, index) => {
      const toolName = step.action?.tool || 'unknown_tool';
      const toolInput = step.action?.toolInput || {};
      const observation = step.observation || 'No result';

      langfuseService.createEvent(context.trace, {
        name: `tool_call_${toolName}`,
        input: {
          step: index + 1,
          tool: toolName,
          input: toolInput,
        },
        output: {
          observation: observation,
          success: !!observation,
        },
        metadata: {
          toolName,
          stepIndex: index,
          hasResult: !!observation,
        },
      });
    });
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
