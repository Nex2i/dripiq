import { getLeadById, updateLead } from '../lead.service';
import { siteAnalysisAgent } from './langchain';
import { EmbeddingsService } from './embeddings.service';
import { SiteScrapeService } from './siteScrape.service';
import { ContactExtractionService } from './contactExtraction.service';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);
    const domain = url.getDomain();

    await Promise.allSettled([
      LeadAnalyzerService.summarizeSite(tenantId, leadId, domain),
      LeadAnalyzerService.extractContacts(tenantId, leadId, domain),
    ]);
  },
  summarizeSite: async (tenantId: string, leadId: string, domain: string) => {
    // Run site analysis
    const aiOutput = await siteAnalysisAgent.analyze(domain);

    if (!aiOutput?.finalResponseParsed) {
      throw new Error('AI output is required');
    }

    // Save site analysis results to lead
    await updateLead(tenantId, leadId, {
      summary: aiOutput.finalResponseParsed.summary,
      products: aiOutput.finalResponseParsed.products,
      services: aiOutput.finalResponseParsed.services,
      differentiators: aiOutput.finalResponseParsed.differentiators,
    });
  },
  extractContacts: async (tenantId: string, leadId: string, domain: string) => {
    const contactResults = await ContactExtractionService.extractAndSaveContacts(
      tenantId,
      leadId,
      domain
    );
    return contactResults;
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

    const oneQuarterAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return lastScrape > oneQuarterAgo;
  },
};
