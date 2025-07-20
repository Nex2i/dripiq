import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '@/libs/logger';
import { promptHelper } from '@/prompts/prompt.helper';
import reportOutputSchema from '../schemas/reportOutputSchema';
import { ReportConfig, FunctionCallLoopResult } from '../interfaces/IReport';
import { AI_MODELS, ServiceResult } from '../reportGenerator/shared';

// Import LangChain tools
import { GetInformationAboutDomainTool } from './tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from './tools/ListDomainPagesTool';
import { RetrieveFullPageTool } from './tools/RetrieveFullPageTool';

export class LangChainReportService {
  private config: Required<ReportConfig>;
  private tools: DynamicStructuredTool[];
  private agent: AgentExecutor | null = null;

  constructor(tools?: DynamicStructuredTool[], config: ReportConfig = {}) {
    this.config = {
      maxIterations: 10,
      model: AI_MODELS.GPT_4_1,
      enableWebSearch: false,
      ...config,
    };

    this.tools = tools || this.getDefaultTools();
    this.initializeAgent();
  }

  private getDefaultTools(): DynamicStructuredTool[] {
    return [
      new GetInformationAboutDomainTool(),
      new ListDomainPagesTool(),
      new RetrieveFullPageTool(),
    ];
  }

  private async initializeAgent(): Promise<void> {
    try {
      const model = new ChatOpenAI({
        modelName: this.config.model,
        temperature: 0,
      });

      // Create a system prompt for the agent
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a helpful assistant that summarizes companies when provided their websites.
Use the available tools to gather information about the domain and provide a comprehensive summary.
For your final response you must return JSON. The JSON must be valid and match the schema provided.

Available tools:
{tools}

Use the following format:
Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer in JSON format`,
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      const agent = await createToolCallingAgent({
        llm: model,
        tools: this.tools,
        prompt,
      });

      this.agent = new AgentExecutor({
        agent,
        tools: this.tools,
        maxIterations: this.config.maxIterations,
        verbose: process.env.NODE_ENV === 'development',
      });
    } catch (error) {
      logger.error('Failed to initialize LangChain agent:', error);
      throw error;
    }
  }

  async summarizeSite(
    siteUrl: string
  ): Promise<ServiceResult<FunctionCallLoopResult<z.infer<typeof reportOutputSchema>>>> {
    try {
      if (!this.agent) {
        await this.initializeAgent();
      }

      if (!this.agent) {
        return {
          success: false,
          error: 'Failed to initialize LangChain agent',
        };
      }

      // Create the input prompt
      const outputSchemaJson = JSON.stringify(reportOutputSchema.shape, null, 2);
      const prompt = promptHelper.getPromptAndInject('summarize_site', {
        domain: siteUrl,
        output_schema: outputSchemaJson,
      });

      // Execute the agent
      const startTime = Date.now();
      const result = await this.agent.invoke({
        input: prompt,
        chat_history: [],
      });

      const executionTime = Date.now() - startTime;
      logger.info(`LangChain agent execution completed in ${executionTime}ms`);

      // Parse the response
      const parseResult = this.parseFinalResponse(result.output);
      if (!parseResult.success) {
        return {
          success: false,
          error: 'Failed to parse agent response',
          details: parseResult.error,
        };
      }

      // Extract function call history from intermediate steps
      const functionCalls = this.extractFunctionCallHistory(result.intermediateSteps || []);

      return {
        success: true,
        data: {
          finalResponse: result.output,
          finalResponseParsed: parseResult.data,
          totalIterations: functionCalls.length,
          functionCalls,
        },
      };
    } catch (error) {
      logger.error('LangChain summarizeSite error:', error);
      return {
        success: false,
        error: 'Failed to summarize site with LangChain',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private parseFinalResponse(response: string): ServiceResult<z.infer<typeof reportOutputSchema>> {
    try {
      // Try to extract JSON from the response
      let jsonStr = response;
      
      // If response contains other text, try to extract JSON block
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        jsonStr = jsonMatch[1] || jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      const validated = reportOutputSchema.parse(parsed);
      
      return {
        success: true,
        data: validated,
      };
    } catch (parseError) {
      logger.error('Failed to parse LangChain response:', parseError);
      return {
        success: false,
        error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
      };
    }
  }

  private extractFunctionCallHistory(intermediateSteps: any[]): any[] {
    return intermediateSteps.map((step, index) => {
      const action = step.action;
      const observation = step.observation;

      return {
        functionName: action?.tool || 'unknown',
        arguments: action?.toolInput || {},
        result: {
          success: true,
          data: observation,
        },
      };
    });
  }

  // Method to add tools at runtime
  addTool(tool: DynamicStructuredTool): void {
    this.tools.push(tool);
    // Re-initialize agent with new tools
    this.agent = null;
    this.initializeAgent();
  }

  // Method to add multiple tools
  addTools(tools: DynamicStructuredTool[]): void {
    this.tools.push(...tools);
    // Re-initialize agent with new tools
    this.agent = null;
    this.initializeAgent();
  }

  // Get current tools
  getTools(): DynamicStructuredTool[] {
    return [...this.tools];
  }
}