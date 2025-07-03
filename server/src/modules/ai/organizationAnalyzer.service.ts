import { TenantService } from '../tenant.service';
import { reportGeneratorService } from './reportGenerator.service';
import { SiteAnalyzerDto, SiteAnalyzerService, tenantSiteKey } from './siteAnalyzer.service';

export const OrganizationAnalyzerService = {
  analyzeOrganization: async (tenantId: string) => {
    const { id, organizationWebsite } = await TenantService.getTenantById(tenantId);

    if (!organizationWebsite) {
      throw new Error('Organization website is required');
    }

    const siteAnalyzerDto: SiteAnalyzerDto = {
      storageKey: tenantSiteKey(id),
      siteUrl: organizationWebsite,
    };

    const siteAnalyzerResult = await SiteAnalyzerService.analyzeSite(siteAnalyzerDto);
    await reportGeneratorService.summarizeSite(organizationWebsite.getDomain());

    return siteAnalyzerResult;
  },
};
