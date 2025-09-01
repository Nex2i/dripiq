import { firecrawlTypes } from '@/libs/firecrawl/firecrawl.metadata';
import { TenantService } from '../tenant.service';
import { EmbeddingsService } from './embeddings.service';
import { siteAnalysisAgent } from './langchain';
import { SiteScrapeService } from './siteScrape.service';

export const OrganizationAnalyzerService = {
  indexSite: async (tenantId: string) => {
    const { website } = await TenantService.getTenantById(tenantId);

    if (!website) {
      throw new Error('Organization website is required');
    }

    const metadata = {
      tenantId,
      type: firecrawlTypes.organization_site,
    };

    if (await OrganizationAnalyzerService.wasLastScrapeTooRecent(website.cleanWebsiteUrl())) {
      await OrganizationAnalyzerService.analyzeOrganization(tenantId);
      return;
    }

    await SiteScrapeService.scrapeSite(website.cleanWebsiteUrl(), metadata, 'organization_site');
  },
  analyzeOrganization: async (tenantId: string) => {
    const { id, website } = await TenantService.getTenantById(tenantId);

    if (!website) {
      throw new Error('Organization website is required');
    }

    // const siteAnalyzerDto: SiteAnalyzerDto = {
    //   storageKey: tenantSiteKey(id),
    //   siteUrl: website,
    // };

    // const _siteAnalyzerResult = await SiteAnalyzerService.analyzeSite(siteAnalyzerDto);
    const aiOutput = await siteAnalysisAgent.analyze(website.cleanWebsiteUrl());

    if (!aiOutput?.finalResponseParsed) {
      throw new Error('AI output is required');
    }
    const { summary, products, services, differentiators, targetMarket, tone } =
      aiOutput.finalResponseParsed;


    // save on tenant
    await TenantService.updateTenant(id, {
      summary: summary,
      products: products,
      services: services,
      differentiators: differentiators,
      targetMarket: targetMarket,
      tone: tone,
    });
  },
  wasLastScrapeTooRecent: async (url: string) => {
    const lastScrape = await EmbeddingsService.getDateOfLastDomainScrape(url.getFullDomain());

    if (!lastScrape) {
      return false;
    }

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastScrape > oneMonthAgo;
  },
};
