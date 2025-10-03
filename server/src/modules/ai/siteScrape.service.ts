import { URL } from 'url';
import { type SearchResultWeb } from '@mendable/firecrawl-js';
import { logger } from '@/libs/logger';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { smartUrlFilterAgent } from './langchain';

export type SiteType = 'lead_site' | 'organization_site';

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
    const maxSiteMapForSmartFilter = 300; // Skip smart filter for very large sitemaps
    const startTime = Date.now();

    // If sitemap is small enough, skip filtering
    if (siteMap.length <= minUrls) {
      logger.info('Sitemap size below minimum, skipping smart filter', {
        siteMapLength: siteMap.length,
        minUrls,
      });
      return siteMap.map((url) => url.url);
    }

    // If sitemap is too large, skip smart filter to avoid timeouts
    if (siteMap.length > maxSiteMapForSmartFilter) {
      logger.warn('Sitemap too large for smart filter, using first URLs with max limit', {
        siteMapLength: siteMap.length,
        maxSiteMapForSmartFilter,
        maxUrls,
      });
      return siteMap.slice(0, maxUrls).map((url) => url.url);
    }

    try {
      let finalUrls = await smartUrlFilterAgent.execute(
        siteMap.map((url) => url.url),
        siteType,
        options,
        minUrls,
        maxUrls,
        siteType
      );

      if (finalUrls.length < minUrls) {
        logger.warn('LLM returned fewer URLs than minimum, using all input URLs', {
          returnedCount: finalUrls.length,
          minUrls,
        });
        finalUrls = siteMap.map((url) => url.url);
      }

      if (finalUrls.length > maxUrls) {
        logger.info('LLM returned more URLs than maximum, truncating', {
          returnedCount: finalUrls.length,
          maxUrls,
        });
        finalUrls = finalUrls.slice(0, maxUrls);
      }

      const executionTimeMs = Date.now() - startTime;

      logger.info('Successfully filtered site map with LangFuse prompt', {
        inputCount: siteMap.length,
        outputCount: finalUrls.length,
        executionTimeMs,
      });

      return finalUrls;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';

      logger.error('Failed to smart filter site map, falling back to URLs with max limit', {
        error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        isTimeout,
        siteMapLength: siteMap.length,
        executionTimeMs,
        siteType,
        domain: options.domain,
      });

      // Fallback: return all URLs but enforce max limit
      const fallbackUrls = siteMap.map((url) => url.url).slice(0, maxUrls);

      logger.info('Applied max limit to fallback URLs after smart filter error', {
        originalCount: siteMap.length,
        limitedCount: fallbackUrls.length,
        maxUrls,
        executionTimeMs,
        isTimeout,
        fallbackStrategy: isTimeout ? 'timeout_fallback' : 'error_fallback',
      });

      return fallbackUrls;
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
