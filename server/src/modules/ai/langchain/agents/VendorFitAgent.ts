import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from '@langchain/core/tools';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import { promptHelper } from '@/prompts/prompt.helper';
import vendorFitOutputSchema from '../../schemas/vendorFitOutputSchema';
import vendorFitInputSchema from '../../schemas/vendorFitInputSchema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '@/libs/logger';
import { z } from 'zod';

export type VendorFitResult = {
  finalResponse: string;
  finalResponseParsed: z.infer<typeof vendorFitOutputSchema>;
  totalIterations: number;
  functionCalls: any[];
};

export class VendorFitAgent {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    this.config = config;
    const model = createChatModel(config);
    
    const tools: DynamicTool[] = [
      ListDomainPagesTool,
      GetInformationAboutDomainTool, 
      RetrieveFullPageTool
    ];

    // Create a prompt template that will be populated at runtime
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "{system_prompt}"],
      ["human", "Analyze the vendor fit between the Partner and Opportunity provided."],
      ["placeholder", "{agent_scratchpad}"],
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

  async analyzeVendorFit(partnerInfo: any, opportunityContext: string): Promise<VendorFitResult> {
    // Generate the system prompt with injected variables at runtime
    const systemPrompt = promptHelper.getPromptAndInject('vendor_fit', {
      input_schema: JSON.stringify(zodToJsonSchema(vendorFitInputSchema), null, 2),
      partner_details: JSON.stringify(partnerInfo, null, 2),
      opportunity_details: opportunityContext,
      output_schema: JSON.stringify(zodToJsonSchema(vendorFitOutputSchema), null, 2)
    });

    try {
      const result = await this.agent.invoke({
        input: "Analyze the vendor fit between the Partner and Opportunity provided.",
        system_prompt: systemPrompt,
      });

      let analysisResult = result.output;

      // Check if we reached max iterations and have intermediate steps but no final output
      if (!result.output && result.intermediateSteps && result.intermediateSteps.length > 0) {
        console.log('Agent hit max iterations, performing final summarization...');
        
        // Create a summarization prompt based on what the agent has gathered so far
        const summaryModel = createChatModel({ model: 'gpt-4.1-mini' });
        
        // Build context from intermediate steps
        const gatheredInfo = result.intermediateSteps.map((step: any) => {
          return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${step.observation || 'No result'}\n`;
        }).join('\n---\n');
        
        const finalSummaryPrompt = `You are a vendor fit analysis expert. Based on the partial research conducted below, provide a comprehensive vendor fit analysis between the Partner and Opportunity.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even though the research may be incomplete, provide the best possible vendor fit analysis based on the available information. Focus on what you were able to discover and clearly indicate areas where more research would be beneficial.`;

        const finalResult = await summaryModel.invoke([
          {
            role: "system",
            content: finalSummaryPrompt
          }
        ]);

        analysisResult = finalResult.content as string;
      }

      if (!analysisResult) {
        analysisResult = 'Unable to generate vendor fit analysis due to agent limitations.';
      }

      // Now create structured output from the analysis
      const structuredOutputModel = createChatModel({ model: 'gpt-4.1-mini' }).withStructuredOutput(
        zodToJsonSchema(vendorFitOutputSchema)
      );

      const finalSummaryPrompt = `You are a vendor fit report formatter. Take the following vendor fit analysis and format it into a valid JSON structure that matches the required schema.

Vendor Fit Analysis:
${analysisResult}

Format this into a structured report with headline, subHeadline, summary, partnerProducts, partnerServices, keyDifferentiators, marketAlignment, brandToneMatch, and cta.`;

      const structuredResult = await structuredOutputModel.invoke([
        {
          role: "system",
          content: finalSummaryPrompt
        }
      ]);

      const parsedResult = vendorFitOutputSchema.parse(structuredResult);

      return {
        finalResponse: analysisResult,
        totalIterations: this.config.maxIterations,
        functionCalls: result.intermediateSteps || [],
        finalResponseParsed: parsedResult,
      };
    } catch (error) {
      logger.error('Error in vendor fit analysis:', error);

      // Return a fallback response
      return {
        finalResponse: `Error occurred during vendor fit analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: {
          headline: 'Analysis Unavailable',
          subHeadline: 'Unable to complete vendor fit analysis',
          summary: `An error occurred while analyzing the vendor fit for ${partnerInfo.domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          partnerProducts: partnerInfo.products || [],
          partnerServices: partnerInfo.services || [],
          keyDifferentiators: partnerInfo.differentiators || [],
          marketAlignment: partnerInfo.targetMarket || 'Unknown',
          brandToneMatch: partnerInfo.tone || 'Unknown',
          cta: 'Please contact support for assistance with this analysis.',
        },
      };
    }
  }
}