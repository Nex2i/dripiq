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

export class SiteAnalysisAgent {
  private agent: AgentExecutor;

  constructor(config: LangChainConfig) {
    const model = createChatModel(config);
    
    const tools: DynamicTool[] = [
      new ListDomainPagesTool(),
      new GetInformationAboutDomainTool(), 
      new RetrieveFullPageTool()
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
      verbose: true,
      returnIntermediateSteps: true,
    });
  }

  async analyze(domain: string): Promise<string> {
    // Generate the system prompt with injected variables at runtime
    const systemPrompt = promptHelper.getPromptAndInject('summarize_site', {
      domain: domain,
      output_schema: JSON.stringify(zodToJsonSchema(reportOutputSchema), null, 2)
    });

    const result = await this.agent.invoke({
      domain: domain,
      system_prompt: systemPrompt,
    });

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

      return finalResult.content as string;
    }

    return result.output || 'Unable to generate analysis due to agent limitations.';
  }
}