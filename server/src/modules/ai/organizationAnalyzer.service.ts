import { TenantService } from '../tenant.service';
import { generalSiteReportService } from './reportGenerator/generalSiteReport.factory';
import { SiteAnalyzerDto, tenantSiteKey } from './siteAnalyzer.service';

export const OrganizationAnalyzerService = {
  analyzeOrganization: async (tenantId: string, userId: string) => {
    const { id, website } = await TenantService.getTenantById(tenantId);

    if (!website) {
      throw new Error('Organization website is required');
    }

    const siteAnalyzerDto: SiteAnalyzerDto = {
      storageKey: tenantSiteKey(id),
      siteUrl: website,
    };

    // const _siteAnalyzerResult = await SiteAnalyzerService.analyzeSite(siteAnalyzerDto);
    const aiOutput = await generalSiteReportService.summarizeSite(website.cleanWebsiteUrl());

    if (!aiOutput?.finalResponseParsed) {
      throw new Error('AI output is required');
    }
    ``;
    const { summary, products, services, differentiators, targetMarket, tone } =
      aiOutput.finalResponseParsed;
    // save on tenant
    await TenantService.updateTenant(userId, id, {
      summary: summary,
      products: products,
      services: services,
      differentiators: differentiators,
      targetMarket: targetMarket,
      tone: tone,
    });
  },
};
