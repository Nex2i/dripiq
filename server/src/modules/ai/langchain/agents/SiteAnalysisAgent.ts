import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from '@langchain/core/tools';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';

const SITE_ANALYSIS_PROMPT = `You are a website analysis expert. Your task is to thoroughly analyze a website by:

1. First, use the ListDomainPagesTool to see what pages are available for the domain
2. Use GetInformationAboutDomainTool to search for specific information based on your analysis goals
3. Use RetrieveFullPageTool to get the full content of important pages when needed
4. Provide a comprehensive analysis including the company's products, services, differentiators, target market, tone, and contact information

Be thorough and systematic in your analysis. Use multiple tool calls to gather complete information before providing your final analysis.

You have access to the following tools: {tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;

export class SiteAnalysisAgent {
  private agent: AgentExecutor;

  constructor(config: LangChainConfig) {
    const model = createChatModel(config);
    
    const tools: DynamicTool[] = [
      new ListDomainPagesTool(),
      new GetInformationAboutDomainTool(), 
      new RetrieveFullPageTool()
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SITE_ANALYSIS_PROMPT],
      ["human", "{input}"],
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
    });
  }

  async analyze(domain: string): Promise<string> {
    const result = await this.agent.invoke({
      input: `Analyze the website for domain: ${domain}. Provide a comprehensive analysis including products, services, differentiators, target market, tone, and contact information.`,
    });

    return result.output;
  }
}