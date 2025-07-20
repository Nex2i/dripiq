import { getLeadById, updateLead } from '../lead.service';
import { siteAnalysisAgent } from './langchain';
import { EmbeddingsService } from './embeddings.service';
import { SiteScrapeService } from './siteScrape.service';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);

    const aiOutput = await siteAnalysisAgent.analyze(url.getDomain());

    if (!aiOutput?.finalResponseParsed) {
      throw new Error('AI output is required');
    }

    // save on lead
    await updateLead(tenantId, leadId, {
      summary: aiOutput.finalResponseParsed.summary,
      products: aiOutput.finalResponseParsed.products,
      services: aiOutput.finalResponseParsed.services,
      differentiators: aiOutput.finalResponseParsed.differentiators,
    });
  },
  indexSite: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);

    if (await LeadAnalyzerService.wasLastScrapeTooRecent(url.getDomain())) {
      await LeadAnalyzerService.analyze(tenantId, leadId);
      return;
    }

    const metadata = {
      leadId,
      tenantId,
      type: 'lead_site',
    };

    await SiteScrapeService.scrapeSite(url.cleanWebsiteUrl(), metadata);
  },

  wasLastScrapeTooRecent: async (url: string) => {
    const lastScrape = await EmbeddingsService.getDateOfLastDomainScrape(url.getDomain());

    if (!lastScrape) {
      return false;
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastScrape > oneWeekAgo;
  },
};
