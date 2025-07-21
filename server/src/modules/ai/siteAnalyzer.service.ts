import { supabaseStorage } from '@/libs/supabase.storage';
import { FireCrawlWebhookPayload } from '@/libs/firecrawl/firecrawl';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { EmbeddingsService } from './embeddings.service';
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

        if (metadata.statusCode === 404) {
          return;
        }

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
        // Mark scraping as complete and then start analysis
        await LeadAnalyzerService.scrapingComplete(metadata.tenantId, metadata.leadId);
        await LeadAnalyzerService.analyze(metadata.tenantId, metadata.leadId);
        break;
    }
  },
};

export const tenantSiteKey = (tenantId: string): string => {
  return `${tenantId}`;
};
