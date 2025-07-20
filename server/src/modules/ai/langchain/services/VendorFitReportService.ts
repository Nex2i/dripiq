import { z } from 'zod';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { createChatModel, LangChainConfig, ReportConfig } from '../config/langchain.config';
import vendorFitOutputSchema from '../../schemas/vendorFitOutputSchema';
import vendorFitInputSchema from '../../schemas/vendorFitInputSchema';
import { logger } from '@/libs/logger';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
      temperature: 0.8,
      maxIterations: 10,
      timeout: 60000,
      ...config,
    };

    this.agent = new VendorFitAgent(this.config);
  }

  async generateVendorFitReport(
    partnerInfo: z.infer<typeof vendorFitInputSchema>,
    opportunityDescription: string = 'potential business opportunity'
  ): Promise<VendorFitResult> {
    try {
      logger.info(`Starting vendor fit analysis for domain: ${partnerInfo.domain}`);

      // Use structured output with JSON schema
      const structuredOutputModel = createChatModel(this.config).withStructuredOutput(
        zodToJsonSchema(vendorFitOutputSchema)
      );

      // First, get the analysis from the agent
      const analysisResult = await this.agent.analyzeVendorFit(partnerInfo, opportunityDescription);

      logger.info('Agent vendor fit analysis completed, now generating structured output');

      // Then format it into the required structure using the JSON schema
      let structuredResult;
      try {
        structuredResult = await structuredOutputModel.invoke([
          {
            role: 'system',
            content: `You are a vendor fit report formatter. Take the following vendor fit analysis and format it into a structured JSON response that matches the provided schema. Create compelling, specific content about the partnership opportunity including headline, summary, products, services, differentiators, market alignment, brand tone match, and call-to-action.`,
          },
          {
            role: 'user',
            content: `Vendor Fit Analysis Results:\n\n${analysisResult}\n\nPartner Information:\n${JSON.stringify(partnerInfo, null, 2)}\n\nPlease format this into the required JSON structure for a vendor fit report.`,
          },
        ]);

        // Validate against schema
        structuredResult = vendorFitOutputSchema.parse(structuredResult);
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
