import { IUploadFile, supabaseStorage } from '@/libs/supabase.storage';
import { logger } from '@/libs/logger';
import { EmbeddingsService } from './embeddings.service';
import { ScrapingResult, ScrappingService } from './scraping.service';

export interface SiteAnalyzerDto {
  storageKey: string;
  siteUrl: string;
}

export interface IStoredMarkdown {
  siteUrl: string;
  markdown: string;
}

export const SiteAnalyzerService = {
  analyzeSite: async (analyzeSiteDto: SiteAnalyzerDto) => {
    try {
      const { siteUrl } = analyzeSiteDto;
      const markdown = await ScrappingService.scrapeSite(siteUrl);
      const cleanedMarkdown = prepareMarkdown(markdown);
      await supabaseStorage.uploadFiles(siteUrl.getDomain(), cleanedMarkdown);
      await EmbeddingsService.batchCreateSiteEmbedding(siteUrl, markdown.results);
      return markdown;
    } catch (error) {
      logger.error(`Error analyzing site ${analyzeSiteDto.siteUrl}`, error);
    }
  },
};

export const tenantSiteKey = (tenantId: string): string => {
  return `${tenantId}`;
};

// returns array of json objects
function prepareMarkdown(scrapeResponse: ScrapingResult): IUploadFile[] {
  return scrapeResponse.results.map((item) => ({
    fileBody: new Blob([JSON.stringify(item)], { type: 'application/json' }),
    contentType: 'application/json',
    fileName: item.url.getUrlSlug() + '.json',
    slug: item.url.getUrlSlug(),
  }));
}
