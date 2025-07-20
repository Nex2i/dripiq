import { z } from 'zod';
import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { createChatModel, LangChainConfig, ReportConfig } from '../config/langchain.config';
import reportOutputSchema from '../../schemas/reportOutputSchema';
import { logger } from '@/libs/logger';

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
      temperature: 0.1,
      maxTokens: 4000,
      maxIterations: 10,
      timeout: 60000,
      ...config,
    };
    
    this.agent = new SiteAnalysisAgent(this.config);
  }

  async summarizeSite(url: string): Promise<SiteAnalysisResult> {
    try {
      logger.info(`Starting site analysis for: ${url}`);
      
      // Use a model for structured output generation
      const structuredOutputModel = createChatModel(this.config);
      
      // First, get the analysis from the agent
      const analysisResult = await this.agent.analyze(url);
      
      logger.info('Agent analysis completed, now generating structured output');
      
      // Then format it into the required structure
      const structuredResponse = await structuredOutputModel.invoke([
        {
          role: "system",
          content: `You are a data formatter. Take the following website analysis and format it into a valid JSON structure that matches this schema:

{
  "summary": "A comprehensive 2500-word markdown summary",
  "products": ["Array of products offered"],
  "services": ["Array of services offered"],  
  "differentiators": ["Array of key differentiators"],
  "targetMarket": "Target market description",
  "tone": "Company tone description",
  "contacts": [
    {
      "type": "email|phone|address|form|other",
      "value": "contact detail",
      "context": "context or department",
      "person": "person name",
      "role": "person role"
    }
  ]
}

Respond with ONLY valid JSON that matches this structure. If any information is missing, make reasonable inferences.`
        },
        {
          role: "user", 
          content: `Website Analysis Results:\n\n${analysisResult}\n\nPlease format this into the required JSON structure.`
        }
      ]);

      // Parse the JSON response
      let structuredResult;
      try {
        const jsonContent = structuredResponse.content as string;
        structuredResult = JSON.parse(jsonContent);
        
        // Validate against schema
        const validatedResult = reportOutputSchema.parse(structuredResult);
        structuredResult = validatedResult;
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