import { URL } from 'url';
import z from 'zod';
import { type SearchResultWeb } from '@mendable/firecrawl-js';
import { logger } from '@/libs/logger';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { createChatModel } from './langchain/config/langchain.config';
import { getContentFromMessage } from './langchain/utils/messageUtils';
import { promptManagementService } from './langchain/services/promptManagement.service';
import {
  smartFilterTracingService,
  type SmartFilterTraceMetadata,
} from './langchain/services/smartFilterTracing.service';

const smartFilterSiteMapSchema = z.object({
  urls: z.array(z.string()).describe('The filtered list of URLs'),
});

type SiteType = 'lead_site' | 'organization_site';

export interface SmartFilterOptions {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  domain?: string;
}

export const SiteScrapeService = {
  scrapeSite: async (url: string, metadata: Record<string, string>, siteType: SiteType) => {
    let siteMap = await firecrawlClient.getSiteMap(url.cleanWebsiteUrl());

    siteMap = SiteScrapeService.filterUrls(siteMap);

    const siteUrls = await SiteScrapeService.smartFilterSiteMap(siteMap, siteType);

    await firecrawlClient.batchScrapeUrls(siteUrls, metadata);
  },

  smartFilterSiteMap: async (
    siteMap: SearchResultWeb[],
    siteType: SiteType,
    options: SmartFilterOptions = {}
  ): Promise<string[]> => {
    const minUrls = 45;
    const maxUrls = 75;
    const startTime = Date.now();

    // If sitemap is small enough, skip filtering
    if (siteMap.length <= minUrls) {
      logger.info('Sitemap size below minimum, skipping smart filter', {
        siteMapLength: siteMap.length,
        minUrls,
      });
      return siteMap.map((url) => url.url);
    }

    // Create trace for observability
    const traceMetadata: SmartFilterTraceMetadata = {
      tenantId: options.tenantId,
      userId: options.userId,
      sessionId: options.sessionId,
      domain: options.domain,
      siteType,
      inputUrlCount: siteMap.length,
      minUrls,
      maxUrls,
    };

    const trace = smartFilterTracingService.createTrace(traceMetadata);

    try {
      // Fetch prompt from LangFuse
      const prompt = await promptManagementService.fetchPrompt('smart_filter', {
        cacheTtlSeconds: 300, // Cache for 5 minutes
      });

      // Prepare variables for prompt compilation
      const variables = {
        urls: JSON.stringify(siteMap, null, 2),
        output_schema: JSON.stringify(z.toJSONSchema(smartFilterSiteMapSchema), null, 2),
        min_urls: minUrls.toString(),
        max_urls: maxUrls.toString(),
        site_type: siteType,
      };

      // Compile prompt with variables
      const compiledPrompt = prompt.compile(variables);

      // Create chat model with structured output
      const chatModel = createChatModel({
        model: 'gpt-5-nano',
      }).withStructuredOutput(z.toJSONSchema(smartFilterSiteMapSchema));

      // Create generation span for LLM call
      const generation = smartFilterTracingService.createGeneration(
        trace,
        compiledPrompt,
        'gpt-5-nano'
      );

      // Invoke the LLM
      const response = await chatModel.invoke([
        {
          role: 'system',
          content: compiledPrompt,
        },
      ]);

      // Parse response
      const parsedResponse = parseWithSchema(response);

      // End generation span with output
      smartFilterTracingService.endGeneration(
        generation,
        JSON.stringify(parsedResponse)
        // Note: Token usage would need to be extracted from response if available
      );

      // Apply business rules for URL count
      let finalUrls = parsedResponse.urls;

      if (parsedResponse.urls.length < minUrls) {
        logger.warn('LLM returned fewer URLs than minimum, using all input URLs', {
          returnedCount: parsedResponse.urls.length,
          minUrls,
        });
        finalUrls = siteMap.map((url) => url.url);
      }

      if (parsedResponse.urls.length > maxUrls) {
        logger.info('LLM returned more URLs than maximum, truncating', {
          returnedCount: parsedResponse.urls.length,
          maxUrls,
        });
        finalUrls = parsedResponse.urls.slice(0, maxUrls);
      }

      // Record successful result
      const executionTimeMs = Date.now() - startTime;
      smartFilterTracingService.recordResult(trace, {
        outputUrlCount: finalUrls.length,
        executionTimeMs,
        success: true,
        usedFallback: finalUrls.length === siteMap.length,
        promptVersion: prompt.version,
      });

      logger.info('Successfully filtered site map with LangFuse prompt', {
        inputCount: siteMap.length,
        outputCount: finalUrls.length,
        executionTimeMs,
        promptVersion: prompt.version,
      });

      return finalUrls;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Record error in trace
      smartFilterTracingService.recordError(trace, error as Error);

      // Record failed result
      smartFilterTracingService.recordResult(trace, {
        outputUrlCount: siteMap.length,
        executionTimeMs,
        success: false,
        error: (error as Error).message,
        usedFallback: true,
      });

      logger.error('Failed to smart filter site map, falling back to all URLs', {
        error,
        siteMapLength: siteMap.length,
        executionTimeMs,
      });

      // Fallback: return all URLs
      return siteMap.map((url) => url.url);
    }
  },

  filterUrls: (urls: SearchResultWeb[]): SearchResultWeb[] => {
    return urls.filter((url) => {
      try {
        const { pathname } = new URL(url.url);
        return !excludeRegex.test(pathname);
      } catch {
        return false;
      }
    });
  },
};

function parseWithSchema(response: any) {
  try {
    const content = getContentFromMessage(response);
    // Remove markdown code fencing and whitespace if present
    const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
    return smartFilterSiteMapSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    logger.warn('Parsing failed, returning fallback.', error);
    throw error;
  }
}

const excludePathPattern = [
  '^/blog(?:/.*)?$',
  '^/support(?:/.*)?$',
  '^/privacy(?:-policy)?(?:/.*)?$',
  '^/terms(?:-of-(service|use|conditions))?(?:/.*)?$',
  '^/(careers?|jobs)(?:/.*)?$',
  '^/wp-content(?:/.*)?$',
  '^/wp-includes(?:/.*)?$',
  '^/wp-admin(?:/.*)?$',
  '^/wp-login(?:/.*)?$',
  '^/wp-register(?:/.*)?$',
  '^/wp-trackback(?:/.*)?$',
  '^/wp-json(?:/.*)?$',
  '^/wp-jsonp(?:/.*)?$',
].join('|');
const excludeRegex = new RegExp(excludePathPattern, 'i');
