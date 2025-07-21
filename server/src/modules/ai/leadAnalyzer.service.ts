import { getLeadById, updateLead, updateLeadStatuses } from '../lead.service';
import { siteAnalysisAgent } from './langchain';
import { EmbeddingsService } from './embeddings.service';
import { SiteScrapeService } from './siteScrape.service';
import { ContactExtractionService } from './contactExtraction.service';
import { LEAD_STATUS } from '../../constants/leadStatus.constants';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);
    const domain = url.getDomain();

    // Remove "New" status and add "Analyzing Site" status
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.ANALYZING_SITE],
      [LEAD_STATUS.NEW]
    );

    await Promise.allSettled([
      LeadAnalyzerService.summarizeSite(tenantId, leadId, domain),
      LeadAnalyzerService.extractContacts(tenantId, leadId, domain),
    ]);

    // Mark analysis as complete
    await LeadAnalyzerService.analysisComplete(tenantId, leadId);
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
    await updateLeadStatuses(tenantId, leadId, [LEAD_STATUS.EXTRACTING_CONTACTS]);

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

    // Add "Scraping Site" status
    await updateLeadStatuses(tenantId, leadId, [LEAD_STATUS.SCRAPING_SITE]);

    const metadata = {
      leadId,
      tenantId,
      type: 'lead_site',
    };

    await SiteScrapeService.scrapeSite(url.cleanWebsiteUrl(), metadata);
  },

  scrapingComplete: async (tenantId: string, leadId: string) => {
    // Remove "Scraping Site" status and add "Analyzing Site" status
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.ANALYZING_SITE],
      [LEAD_STATUS.SCRAPING_SITE]
    );
  },

  analysisComplete: async (tenantId: string, leadId: string) => {
    // Remove analysis and extraction statuses, add "Processed" status
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.PROCESSED],
      [LEAD_STATUS.ANALYZING_SITE, LEAD_STATUS.EXTRACTING_CONTACTS]
    );
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
