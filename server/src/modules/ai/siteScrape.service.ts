import { URL } from 'url';
import z from 'zod';
import { logger } from '@/libs/logger';
import { promptHelper } from '@/prompts/prompt.helper';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { createChatModel } from './langchain/config/langchain.config';

export const SiteScrapeService = {
  scrapeSite: async (url: string, metadata: Record<string, any>) => {
    let siteMap = await firecrawlClient.getSiteMap(url.cleanWebsiteUrl());

    siteMap = filterUrls(siteMap);

    siteMap = await SiteScrapeService.smartFilterSiteMap(siteMap);

    await firecrawlClient.batchScrapeUrls(siteMap, metadata);
  },

  smartFilterSiteMap: async (siteMap: string[]): Promise<string[]> => {
    const minUrls = 25;
    const maxUrls = 75;
    if (siteMap.length <= 25) {
      return siteMap;
    }

    const schema = z.object({
      urls: z.array(z.string()).describe('The filtered list of URLs'),
    });
    const chatModel = createChatModel({ model: 'gpt-4.1-mini' }).withStructuredOutput(
      z.toJSONSchema(schema)
    );

    const initialPrompt = promptHelper.getPromptAndInject('smart_filter_site', {
      urls: siteMap.join('\n'),
      output_schema: JSON.stringify(z.toJSONSchema(schema), null, 2),
      min_urls: minUrls.toString(),
      max_urls: maxUrls.toString(),
    });

    try {
      const parsedResponse = await chatModel.invoke([
        {
          role: 'system',
          content: initialPrompt,
        },
      ]);

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
