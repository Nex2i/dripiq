import { TenantService } from '../tenant.service';
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
      type: 'organization_site',
    };

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
};
