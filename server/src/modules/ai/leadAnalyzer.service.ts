import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { getLeadById, updateLead } from '../lead.service';
import { generalSiteReportService } from './reportGenerator/generalSiteReport.factory';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);

    const aiOutput = await generalSiteReportService.summarizeSite(url.cleanWebsiteUrl());

    if (!aiOutput.success || !aiOutput.data?.finalResponseParsed) {
      throw new Error('AI output is required');
    }

    // save on lead
    await updateLead(tenantId, leadId, {
      summary: aiOutput.data.finalResponseParsed.summary,
      products: aiOutput.data.finalResponseParsed.products,
      services: aiOutput.data.finalResponseParsed.services,
      differentiators: aiOutput.data.finalResponseParsed.differentiators,
      brandColors: aiOutput.data.finalResponseParsed.brandColors,
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
