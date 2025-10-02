import { logger } from '@/libs/logger';
import { LangChainConfig } from '../config/langchain.config';
import {
  SmartUrlFilterMapSchemaOutput,
  smartUrlFilterMapSchema,
} from '../../schemas/smartFilters/urlSmartFilterSchemas';
import { DefaultAgentExecuter } from './AgentExecuter';
import { SiteType } from '@/modules/ai/siteScrape.service';

export class SmartUrlFilterAgent {
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    this.config = config;
  }

  async execute(
    urls: string[],
    tenantId: string,
    metadata: Record<string, any>,
    minUrls: number,
    maxUrls: number,
    siteType: SiteType
  ): Promise<string[]> {
    const startTime = Date.now();
    try {
      const variables = {
        urls: JSON.stringify(urls, null, 2),
        min_urls: minUrls.toString(),
        max_urls: maxUrls.toString(),
        site_type: siteType,
      };
      const agentResult = await DefaultAgentExecuter<SmartUrlFilterMapSchemaOutput>({
        promptName: 'smart_url_filter',
        tenantId,
        variables,
        config: this.config,
        outputSchema: smartUrlFilterMapSchema,
        tools: [],
        metadata,
        tags: ['smart_url_filter'],
      });

      return agentResult.output.urls;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      logger.error('Smart URL filter failed:', {
        error,
        urls,
        tenantId,
        executionTimeMs,
      });
      throw error;
    }
  }
}
