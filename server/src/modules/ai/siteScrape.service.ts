import { URL } from 'url';
import z from 'zod';
import { logger } from '@/libs/logger';
import { promptHelper } from '@/prompts/prompt.helper';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { createChatModel, defaultLangChainConfig } from './langchain/config/langchain.config';
import { getContentFromMessage } from './langchain/utils/messageUtils';

const smartFilterSiteMapSchema = z.object({
  urls: z.array(z.string()).describe('The filtered list of URLs'),
});

type SiteType = 'lead_site' | 'organization_site';

export const SiteScrapeService = {
  scrapeSite: async (url: string, metadata: Record<string, any>, siteType: SiteType) => {
    let siteMap = await firecrawlClient.getSiteMap(url.cleanWebsiteUrl());

    siteMap = filterUrls(siteMap);

    siteMap = await SiteScrapeService.smartFilterSiteMap(siteMap, siteType);

    await firecrawlClient.batchScrapeUrls(siteMap, metadata);
  },

  smartFilterSiteMap: async (siteMap: string[], siteType: SiteType): Promise<string[]> => {
    const minUrls = 25;
    const maxUrls = 75;
    if (siteMap.length <= 25) {
      return siteMap;
    }

    try {
      const chatModel = createChatModel({
        model: defaultLangChainConfig.model,
      }).withStructuredOutput(z.toJSONSchema(smartFilterSiteMapSchema));

      const initialPrompt = promptHelper.getPromptAndInject('smart_filter_site', {
        urls: siteMap.join('\n'),
        output_schema: JSON.stringify(z.toJSONSchema(smartFilterSiteMapSchema), null, 2),
        min_urls: minUrls.toString(),
        max_urls: maxUrls.toString(),
        site_type: siteType,
      });

      const response = await chatModel.invoke([
        {
          role: 'system',
          content: initialPrompt,
        },
      ]);

      const parsedResponse = parseWithSchema(response);

      if (parsedResponse.urls.length < minUrls) {
        return siteMap;
      }

      if (parsedResponse.urls.length > maxUrls) {
        return parsedResponse.urls.slice(0, maxUrls);
      }

      return parsedResponse.urls;
    } catch (error) {
      logger.error('Failed to smart filter site map', error);
      return siteMap;
    }
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

function filterUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      const { pathname } = new URL(url);
      return !excludeRegex.test(pathname);
    } catch {
      return false;
    }
  });
}
