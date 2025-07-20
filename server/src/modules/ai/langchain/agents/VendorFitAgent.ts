import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from '@langchain/core/tools';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';

const VENDOR_FIT_PROMPT = `You are a vendor fit analysis expert. Your task is to analyze how well a Partner company fits with an Opportunity by:

1. Use the available tools to research the Partner's website and gather additional context
2. Compare the Partner's offerings, target market, and brand tone with the Opportunity's needs
3. Identify specific products/services that would benefit the Opportunity
4. Highlight key differentiators that set the Partner apart
5. Assess market alignment and brand compatibility
6. Provide a compelling vendor fit analysis

Be thorough in your research and provide specific, actionable insights about the partnership potential.

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

export class VendorFitAgent {
  private agent: AgentExecutor;

  constructor(config: LangChainConfig) {
    const model = createChatModel(config);
    
    const tools: DynamicTool[] = [
      new ListDomainPagesTool(),
      new GetInformationAboutDomainTool(), 
      new RetrieveFullPageTool()
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", VENDOR_FIT_PROMPT],
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

  async analyzeVendorFit(partnerInfo: any, opportunityContext: string): Promise<string> {
    const partnerData = JSON.stringify(partnerInfo, null, 2);
    
    const result = await this.agent.invoke({
      input: `Analyze the vendor fit between this Partner and the Opportunity:

Partner Information:
${partnerData}

Opportunity Context:
${opportunityContext}

Research the Partner's domain further using the available tools and provide a comprehensive vendor fit analysis including:
- Specific products/services that benefit the Opportunity
- Key differentiators 
- Market alignment
- Brand tone compatibility
- Compelling partnership rationale`,
    });

    return result.output;
  }
}