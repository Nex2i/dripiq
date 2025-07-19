import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { getLeadById, updateLead } from '../lead.service';
import { generalSiteReportService } from './reportGenerator/generalSiteReport.factory';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);

    const aiOutput = await generalSiteReportService.summarizeSite(url.cleanWebsiteUrl());

    if (!aiOutput?.finalResponseParsed) {
      throw new Error('AI output is required');
    }

    // save on lead
    await updateLead(tenantId, leadId, {
      summary: aiOutput.finalResponseParsed.summary,
      products: aiOutput.finalResponseParsed.products,
      services: aiOutput.finalResponseParsed.services,
      differentiators: aiOutput.finalResponseParsed.differentiators,
      brandColors: aiOutput.finalResponseParsed.brandColors,
    });
  },
  indexSite: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);

    const metadata = {
      leadId,
      tenantId,
      type: 'lead_site',
    };

    await firecrawlClient.crawlUrl(url.cleanWebsiteUrl(), metadata);
  },
};
