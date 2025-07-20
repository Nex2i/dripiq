import { z } from 'zod';
import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { createChatModel, LangChainConfig, ReportConfig } from '../config/langchain.config';
import reportOutputSchema from '../../schemas/reportOutputSchema';
import { logger } from '@/libs/logger';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface SiteAnalysisResult {
  finalResponse: string;
  totalIterations: number;
  functionCalls: Array<{
    functionName: string;
    arguments: any;
    result: any;
  }>;
  finalResponseParsed?: z.infer<typeof reportOutputSchema>;
}

export class GeneralSiteReportService {
  private agent: SiteAnalysisAgent;
  private config: LangChainConfig;

  constructor(config: ReportConfig = {}) {
    this.config = {
      model: 'gpt-4.1-mini',
      temperature: 0.8,
      maxIterations: 10,
      timeout: 60000,
      ...config,
    };

    this.agent = new SiteAnalysisAgent(this.config);
  }

  async summarizeSite(url: string): Promise<SiteAnalysisResult> {
    try {
      logger.info(`Starting site analysis for: ${url}`);

      // Use structured output with JSON schema
      const structuredOutputModel = createChatModel(this.config).withStructuredOutput(
        zodToJsonSchema(reportOutputSchema)
      );

      // First, get the analysis from the agent
      const analysisResult = await this.agent.analyze(url);

      logger.info('Agent analysis completed, now generating structured output');

      // Then format it into the required structure using the JSON schema
      let structuredResult;
      try {
        structuredResult = await structuredOutputModel.invoke([
          {
            role: 'system',
            content: `You are a data formatter. Take the following website analysis and format it into a structured JSON response that matches the provided schema. Extract and organize all the relevant information including summary, products, services, differentiators, target market, tone, and contact information.`,
          },
          {
            role: 'user',
            content: `Website Analysis Results:\n\n${analysisResult}\n\nPlease format this into the required JSON structure.`,
          },
        ]);

        // Validate against schema
        structuredResult = reportOutputSchema.parse(structuredResult);
      } catch (parseError) {
        logger.warn('Failed to parse structured output, using fallback:', parseError);
        structuredResult = {
          summary: analysisResult,
          products: [],
          services: [],
          differentiators: [],
          targetMarket: 'Unknown',
          tone: 'Unknown',
          contacts: [],
        };
      }

      logger.info('Structured output generated successfully');

      return {
        finalResponse: analysisResult,
        totalIterations: this.config.maxIterations, // LangChain handles iterations internally
        functionCalls: [], // LangChain manages tool calls internally
        finalResponseParsed: structuredResult,
      };
    } catch (error) {
      logger.error('Error in site analysis:', error);

      // Return a fallback response
      return {
        finalResponse: `Error occurred during site analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalIterations: 1,
        functionCalls: [],
        finalResponseParsed: {
          summary: `Unable to analyze website ${url} due to an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
