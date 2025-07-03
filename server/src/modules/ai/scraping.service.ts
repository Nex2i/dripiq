import { crawl4aiClient } from '@/libs/crawl4ai.client';
import { Crawl4AiPayload } from '@/libs/crawl4AiPayload';

export const ScrappingService = {
  scrapeSite: async (url: string): Promise<ScrapingResult> => {
    const payload: Crawl4AiPayload = {
      urls: [url],
      crawler_config: {
        type: 'CrawlerRunConfig',
        params: {
          deep_crawl_strategy: {
            type: 'BestFirstCrawlingStrategy',
            params: {
              max_depth: 2,
              include_external: false,
              max_pages: 15,
            },
          },
        },
      },
    };
    const markdown = await crawl4aiClient.crawl(payload);
    return markdown;
  },
};

export interface ScrapingResult {
  results: ScrapingResultItem[];
}

export interface ScrapingResultItem {
  url: string;
  html: string | null;
  cleaned_html: string | null;
  links: string[];
  metadata: ScrapingResultMetadata;
  markdown: ScrapingResultMarkdown;
}

export interface ScrapingResultMetadata {
  title: string;
  description: string;
}

export interface ScrapingResultMarkdown {
  markdown_with_citations: string;
  raw_markdown: string;
  references_markdown: string;
}
