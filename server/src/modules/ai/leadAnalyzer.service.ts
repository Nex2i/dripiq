import { getLeadById, updateLead, updateLeadStatuses } from '../lead.service';
import { siteAnalysisAgent } from './langchain';
import { EmbeddingsService } from './embeddings.service';
import { SiteScrapeService } from './siteScrape.service';
import { ContactExtractionService } from './contactExtraction.service';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);
    const domain = url.getDomain();

    // Remove "New" status and add "Analyzing Site" status
    await updateLeadStatuses(tenantId, leadId, ['Analyzing Site'], ['New']);

    await Promise.allSettled([
      LeadAnalyzerService.summarizeSite(tenantId, leadId, domain),
      LeadAnalyzerService.extractContacts(tenantId, leadId, domain),
    ]);

    // Remove "Analyzing Site" status and add "Processed" status when complete
    await updateLeadStatuses(tenantId, leadId, ['Processed'], ['Analyzing Site', 'Extracting Contacts']);
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
    // Add "Extracting Contacts" status
    await updateLeadStatuses(tenantId, leadId, ['Extracting Contacts'], []);

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

    // Add "Scraping Site" status when starting to scrape
    await updateLeadStatuses(tenantId, leadId, ['Scraping Site'], []);

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
