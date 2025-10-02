import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@/libs/logger';
import { LangChainConfig } from '../config/langchain.config';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import reportOutputSchema, { ReportOutput } from '../../schemas/siteAnalysis/reportOutputSchema';
import { DefaultAgentExecuter } from './AgentExecuter';

export type SiteAnalysisResult = {
  finalResponse: string;
  finalResponseParsed: z.infer<typeof reportOutputSchema>;
  totalIterations: number;
  functionCalls: any[];
};

export class SiteAnalysisAgent {
  private config: LangChainConfig;
  private tools: DynamicStructuredTool[];

  constructor(config: LangChainConfig) {
    this.config = config;

    this.tools = [ListDomainPagesTool, GetInformationAboutDomainTool, RetrieveFullPageTool];
  }

  async execute(
    domain: string,
    tenantId: string,
    metadata: Record<string, any>
  ): Promise<SiteAnalysisResult> {
    try {
      const variables = {
        domain: domain.cleanWebsiteUrl(),
      };

      const agentResult = await DefaultAgentExecuter<ReportOutput>({
        promptName: 'summarize_site',
        tenantId,
        variables,
        config: this.config,
        outputSchema: reportOutputSchema,
        tools: this.tools,
        metadata,
        tags: ['summarize_site'],
      });

      return {
        finalResponse: agentResult.output.summary,
        finalResponseParsed: agentResult.output,
        totalIterations: agentResult.intermediateSteps?.length ?? 0,
        functionCalls: agentResult.intermediateSteps ?? [],
      };
    } catch (error) {
      logger.error('Error in site analysis:', error);
      throw error;
    }
  }
}
