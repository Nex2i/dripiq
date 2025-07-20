import { z } from 'zod';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { createChatModel, LangChainConfig, ReportConfig } from '../config/langchain.config';
import vendorFitOutputSchema from '../../schemas/vendorFitOutputSchema';
import vendorFitInputSchema from '../../schemas/vendorFitInputSchema';
import { logger } from '@/libs/logger';

export interface VendorFitResult {
  finalResponse: string;
  totalIterations: number;
  functionCalls: Array<{
    functionName: string;
    arguments: any;
    result: any;
  }>;
  finalResponseParsed?: z.infer<typeof vendorFitOutputSchema>;
}

export class VendorFitReportService {
  private agent: VendorFitAgent;
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
    
    this.agent = new VendorFitAgent(this.config);
  }

  async generateVendorFitReport(
    partnerInfo: z.infer<typeof vendorFitInputSchema>,
    opportunityDescription: string = "potential business opportunity"
  ): Promise<VendorFitResult> {
    try {
      logger.info(`Starting vendor fit analysis for domain: ${partnerInfo.domain}`);
      
      // Use a model for structured output generation
      const structuredOutputModel = createChatModel(this.config);
      
      // First, get the analysis from the agent
      const analysisResult = await this.agent.analyzeVendorFit(partnerInfo, opportunityDescription);
      
      logger.info('Agent vendor fit analysis completed, now generating structured output');
      
      // Then format it into the required structure
      const structuredResponse = await structuredOutputModel.invoke([
        {
          role: "system",
          content: `You are a vendor fit report formatter. Take the following vendor fit analysis and format it into a valid JSON structure that matches this schema:

{
  "headline": "Concise, engaging headline summarizing the vendor fit",
  "subHeadline": "Supporting sentence expanding on the headline",
  "summary": "Detailed markdown summary explaining the fit",
  "partnerProducts": ["Key products beneficial to the opportunity"],
  "partnerServices": ["Relevant services for the opportunity"],
  "keyDifferentiators": ["Distinctive strengths setting the partner apart"],
  "marketAlignment": "How target markets align",
  "brandToneMatch": "How brand tones align or complement",
  "cta": "Clear call-to-action for engagement"
}

Respond with ONLY valid JSON that matches this structure. Make the content compelling and specific to the partnership opportunity.`
        },
        {
          role: "user",
          content: `Vendor Fit Analysis Results:\n\n${analysisResult}\n\nPartner Information:\n${JSON.stringify(partnerInfo, null, 2)}\n\nPlease format this into the required JSON structure for a vendor fit report.`
        }
      ]);

      // Parse the JSON response
      let structuredResult;
      try {
        const jsonContent = structuredResponse.content as string;
        structuredResult = JSON.parse(jsonContent);
        
        // Validate against schema
        const validatedResult = vendorFitOutputSchema.parse(structuredResult);
        structuredResult = validatedResult;
      } catch (parseError) {
        logger.warn('Failed to parse structured output, using fallback:', parseError);
        structuredResult = {
          headline: 'Partnership Opportunity',
          subHeadline: 'Analyzing potential vendor fit',
          summary: analysisResult,
          partnerProducts: partnerInfo.products || [],
          partnerServices: partnerInfo.services || [],
          keyDifferentiators: partnerInfo.differentiators || [],
          marketAlignment: partnerInfo.targetMarket || 'Unknown',
          brandToneMatch: partnerInfo.tone || 'Unknown',
          cta: 'Contact us to explore this partnership opportunity.',
        };
      }

      logger.info('Structured vendor fit output generated successfully');

      return {
        finalResponse: analysisResult,
        totalIterations: this.config.maxIterations, // LangChain handles iterations internally
        functionCalls: [], // LangChain manages tool calls internally
        finalResponseParsed: structuredResult,
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