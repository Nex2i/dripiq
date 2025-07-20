import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from '@langchain/core/tools';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import { promptHelper } from '@/prompts/prompt.helper';
import reportOutputSchema from '../../schemas/reportOutputSchema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '@/libs/logger';
import { z } from 'zod';

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
    
    const tools: DynamicTool[] = [
      ListDomainPagesTool,
      GetInformationAboutDomainTool, 
      RetrieveFullPageTool
    ];

    // Create a prompt template that will be populated at runtime
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `{system_prompt}`],
      ["human", "Analyze the website for domain: {domain}"],
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

  async analyze(domain: string): Promise<SiteAnalysisResult> {
    // Generate the system prompt with injected variables at runtime
    const systemPrompt = promptHelper.getPromptAndInject('summarize_site', {
      domain: domain,
      output_schema: JSON.stringify(zodToJsonSchema(reportOutputSchema), null, 2)
    });

    try {
      const result = await this.agent.invoke({
        input: `Analyze the website for domain: ${domain}`,
        domain: domain,
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
        
        const finalSummaryPrompt = `You are a website analysis expert. Based on the partial research conducted below, provide a comprehensive website analysis for ${domain}.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even though the research may be incomplete, provide the best possible analysis based on the available information. Focus on what you were able to discover and clearly indicate areas where more research would be beneficial.`;

        const finalResult = await summaryModel.invoke([
          {
            role: "system",
            content: finalSummaryPrompt
          }
        ]);

        analysisResult = finalResult.content as string;
      }

      if (!analysisResult) {
        analysisResult = 'Unable to generate analysis due to agent limitations.';
      }

      // Now create structured output from the analysis
      const structuredOutputModel = createChatModel({ model: 'gpt-4.1-mini' }).withStructuredOutput(
        zodToJsonSchema(reportOutputSchema)
      );

      const finalSummaryPrompt = `You are a data formatter. Take the following website analysis and format it into a valid JSON structure that matches the required schema.

Website Analysis:
${analysisResult}

Format this into a structured report with summary, products, services, differentiators, targetMarket, tone, and contacts.`;

      const structuredResult = await structuredOutputModel.invoke([
        {
          role: "system",
          content: finalSummaryPrompt
        }
      ]);

      const parsedResult = reportOutputSchema.parse(structuredResult);

      return {
        finalResponse: analysisResult,
        totalIterations: this.config.maxIterations,
        functionCalls: result.intermediateSteps || [],
        finalResponseParsed: parsedResult,
      };
    } catch (error) {
      logger.error('Error in site analysis:', error);

      // Return a fallback response
      return {
        finalResponse: `Error occurred during site analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: {
          summary: `Unable to analyze website ${domain} due to an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          products: [],
          services: [],
          differentiators: [],
          targetMarket: 'Unknown',
          tone: 'Unknown',
          contacts: [],
        },
      };
    }
  }
}