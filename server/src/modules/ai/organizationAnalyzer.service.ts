import { TenantService } from '../tenant.service';
import { generalSiteReportService } from './reportGenerator/generalSiteReport.factory';

export const OrganizationAnalyzerService = {
  analyzeOrganization: async (tenantId: string, userId: string) => {
    const { id, website } = await TenantService.getTenantById(tenantId);

    if (!website) {
      throw new Error('Organization website is required');
    }

    // const _siteAnalyzerDto: SiteAnalyzerDto = {
    //   storageKey: tenantSiteKey(id),
    //   siteUrl: website,
    // };

    // const _siteAnalyzerResult = await SiteAnalyzerService.analyzeSite(_siteAnalyzerDto);
    const aiOutput = await generalSiteReportService.summarizeSite(website.cleanWebsiteUrl());

    if (!aiOutput.success || !aiOutput.data?.finalResponseParsed) {
      throw new Error('AI output is required');
    }

    const { summary, products, services, differentiators, targetMarket, tone, brandColors } =
      aiOutput.data.finalResponseParsed;
    // save on tenant
    await TenantService.updateTenant(userId, id, {
      summary: summary,
      products: products,
      services: services,
      differentiators: differentiators,
      targetMarket: targetMarket,
      tone: tone,
      brandColors: brandColors,
    });
  },
};
