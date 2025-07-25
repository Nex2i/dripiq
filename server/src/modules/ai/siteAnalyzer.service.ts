import { supabaseStorage } from '@/libs/supabase.storage';
import { FireCrawlWebhookPayload } from '@/libs/firecrawl/firecrawl';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { updateLeadStatuses } from '../lead.service';
import { LEAD_STATUS } from '../../constants/leadStatus.constants';
import { EmbeddingsService } from './embeddings.service';
import { LeadAnalyzerService } from './leadAnalyzer.service';
import { OrganizationAnalyzerService } from './organizationAnalyzer.service';

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
        // Remove "Scraping Site" status when scraping is complete
        await updateLeadStatuses(
          metadata.tenantId,
          metadata.leadId,
          [],
          [LEAD_STATUS.SCRAPING_SITE]
        );
        LeadAnalyzerService.analyze(metadata.tenantId, metadata.leadId);
        break;

      case 'organization_site':
        OrganizationAnalyzerService.analyzeOrganization(metadata.tenantId);
        break;
    }
  },
};

export const tenantSiteKey = (tenantId: string): string => {
  return `${tenantId}`;
};
