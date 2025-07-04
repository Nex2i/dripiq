import { getLeadById, updateLead } from '../lead.service';
import { generalSiteReportService } from './reportGenerator/generalSiteReport.factory';

export const LeadAnalyzerService = {
  analyzeLead: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId, false);

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
      logo: aiOutput.finalResponseParsed.logo,
      brandColors: aiOutput.finalResponseParsed.brandColors,
    });
  },
};
