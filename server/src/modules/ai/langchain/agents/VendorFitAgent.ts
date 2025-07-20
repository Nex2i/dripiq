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

export class VendorFitAgent {
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
      verbose: true,
    });
  }

  async analyzeVendorFit(partnerInfo: any, opportunityContext: string): Promise<string> {
    // Generate the system prompt with injected variables at runtime
    const systemPrompt = promptHelper.getPromptAndInject('vendor_fit', {
      input_schema: JSON.stringify(zodToJsonSchema(vendorFitInputSchema), null, 2),
      partner_details: JSON.stringify(partnerInfo, null, 2),
      opportunity_details: opportunityContext,
      output_schema: JSON.stringify(zodToJsonSchema(vendorFitOutputSchema), null, 2)
    });

    const result = await this.agent.invoke({
      system_prompt: systemPrompt,
    });

    return result.output;
  }
}