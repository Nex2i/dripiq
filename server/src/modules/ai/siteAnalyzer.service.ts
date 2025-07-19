import { IUploadFile, supabaseStorage } from '@/libs/supabase.storage';
import { EmbeddingsService } from './embeddings.service';
import { ScrapingResult } from './scraping.service';
import { FireCrawlWebhookPayload } from '@/libs/firecrawl/firecrawl';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { LeadAnalyzerService } from './leadAnalyzer.service';

export interface SiteAnalyzerDto {
  storageKey: string;
  siteUrl: string;
}

export interface IStoredMarkdown {
  siteUrl: string;
  markdown: string;
}

export const SiteAnalyzerService = {
  analyzePageFromFirecrawl: async (payload: FireCrawlWebhookPayload) => {
    const { id, data } = payload;

    // THIS SHOULD ONLY BE ONE PAGE, SENT AS LIST
    await Promise.allSettled(
      data.map(async (page) => {
        const { markdown, metadata } = page;
        const { url } = metadata;

        const domain = await EmbeddingsService.getOrCreateDomainByUrl(url.getDomain());

        const markdownFile = firecrawlClient.createFirecrawlMarkdownFile(id, page);
        await supabaseStorage.uploadFile(url.getDomain(), markdownFile);

        await EmbeddingsService.createFirecrawlSiteEmbedding(domain, markdown, metadata);
      })
    );
  },
  completeFirecrawlCrawl: async (payload: FireCrawlWebhookPayload) => {
    const { metadata } = payload;

    switch (metadata.type) {
      case 'lead_site':
        LeadAnalyzerService.analyze(metadata.tenantId, metadata.leadId);
        break;
    }
  },
};

export const tenantSiteKey = (tenantId: string): string => {
  return `${tenantId}`;
};
