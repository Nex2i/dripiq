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
import vendorFitInputSchema from '../../schemas/vendorFitInputSchema';
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

export type VendorFitResult = AgentExecutionResult<z.infer<typeof vendorFitOutputSchema>>;

export interface VendorFitInput {
  partnerInfo: any;
  opportunityContext: string;
}

export class VendorFitAgent extends BaseObservableAgent<VendorFitInput, z.infer<typeof vendorFitOutputSchema>> {
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

  protected getAgentName(): string {
    return 'VendorFitAgent';
  }

  protected getAgentVersion(): string {
    return '2.0.0';
  }

  protected getPromptName(): string {
    return 'vendor_fit';
  }

  protected getAgentDescription(): string {
    return 'Analyzes vendor fit between partners and opportunities to determine alignment and potential';
  }

  protected preparePromptContext(input: VendorFitInput): PromptInjectionContext {
    return {
      variables: {
        partner_details: JSON.stringify(input.partnerInfo, null, 2),
        opportunity_details: input.opportunityContext,
        // Note: As per requirements, we're ignoring input_schema and output_schema injection
      },
    };
  }

  protected async executeCore(
    input: VendorFitInput,
    promptContent: string,
    context: AgentTracingContext
  ): Promise<{
    finalResponse: string;
    finalResponseParsed: z.infer<typeof vendorFitOutputSchema>;
    totalIterations: number;
    functionCalls: any[];
  }> {
    // Create generation for LLM tracking
    const generation = context ? langfuseService.createGeneration(context.trace, {
      name: 'vendor_fit_generation',
      model: this.config.model,
      input: {
        partnerInfo: input.partnerInfo,
        opportunityContext: input.opportunityContext,
        promptLength: promptContent.length,
      },
    }) : null;

    try {
      const result = await this.agent.invoke({
        input: {
          partner_details: input.partnerInfo,
          opportunity_details: input.opportunityContext,
        },
        system_prompt: promptContent,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.summarizePartialSteps(result, promptContent, context);
      }

      const finalResponseParsed = parseWithSchema(finalResponse, input.partnerInfo);

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

      logger.error('Vendor fit analysis failed', {
        partnerInfo: input.partnerInfo,
        opportunityContext: input.opportunityContext,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AgentError(
        AgentErrorType.LLM_EXECUTION_ERROR,
        `Vendor fit analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          partnerInfo: input.partnerInfo,
          opportunityContext: input.opportunityContext,
          agentName: this.getAgentName() 
        },
        context?.trace?.id
      );
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async analyzeVendorFit(partnerInfo: any, opportunityContext: string, options?: AgentExecutionOptions): Promise<VendorFitResult> {
    return this.execute({ partnerInfo, opportunityContext }, options);
  }

  private async summarizePartialSteps(
    result: any,
    systemPrompt: string,
    context: AgentTracingContext | null
  ): Promise<string> {
    const summarySpan = context ? langfuseService.createSpan(context.trace, {
      name: 'vendor_fit_partial_summary',
      metadata: {
        stepCount: result.intermediateSteps?.length || 0,
      },
    }) : null;

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
