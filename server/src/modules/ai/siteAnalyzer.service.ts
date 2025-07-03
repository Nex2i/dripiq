// Scrape site and return markdown
// Save full markdown to storage
// split markdown into chunks
// save chunks to storage
// embed chunks in vector database
// create summary of site
// save summary to storage
// save metadata to database
// return metadata

import { EmbeddingsService } from './embeddings.service';
import { ScrapingResult, ScrappingService } from './scraping.service';
import { IUploadFile, supabaseStorage } from '@/libs/supabase.storage';

// TODAY'S GOAL:
// 1. Scrape site and return markdown
// 2. Save full markdown to storage
// 3. Split markdown into chunks
// 4. Save chunks to storage
// 5. Embed chunks in vector database
// 6. Create summary of site
// 7. Save summary to storage
// 8. Save metadata to database
// 9. Return metadata
// Allow users to provide base siteurl
// allow users to view the summary
// Have this viewed in a lead view
// have this stored on the org

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
      throw error;
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
