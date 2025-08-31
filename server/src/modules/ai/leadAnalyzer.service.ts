import { firecrawlTypes } from '@/libs/firecrawl/firecrawl.metadata';
import { getLeadById, updateLead, updateLeadStatuses } from '../lead.service';
import { LEAD_STATUS } from '../../constants/leadStatus.constants';
import { siteAnalysisAgent } from './langchain';
import { EmbeddingsService } from './embeddings.service';
import { SiteScrapeService } from './siteScrape.service';
import { ContactExtractionService } from './contactExtraction.service';

export const LeadAnalyzerService = {
  analyze: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);
    const domain = url.getFullDomain();

    const [siteAnalysisResult, contactExtractionResult] = await Promise.allSettled([
      LeadAnalyzerService.summarizeSite(tenantId, leadId, domain),
      LeadAnalyzerService.extractContacts(tenantId, leadId, domain),
    ]);

    // Remove "Analyzing Site" status and add "Processed" status when complete
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.PROCESSED],
      [LEAD_STATUS.ANALYZING_SITE, LEAD_STATUS.EXTRACTING_CONTACTS]
    );

    // Return contact information for automated campaign creation
    const contacts =
      contactExtractionResult.status === 'fulfilled'
        ? contactExtractionResult.value?.contacts || []
        : [];

    return {
      contactsFound: contacts,
      contactsCreated:
        contactExtractionResult.status === 'fulfilled'
          ? contactExtractionResult.value?.contactsCreated || 0
          : 0,
      siteAnalysisSuccess: siteAnalysisResult.status === 'fulfilled',
      contactExtractionSuccess: contactExtractionResult.status === 'fulfilled',
    };
  },
  summarizeSite: async (tenantId: string, leadId: string, domain: string) => {
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.ANALYZING_SITE],
      [LEAD_STATUS.SYNCING_SITE, LEAD_STATUS.SCRAPING_SITE]
    );

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
    await updateLeadStatuses(tenantId, leadId, [LEAD_STATUS.EXTRACTING_CONTACTS], []);

    const contactResults = await ContactExtractionService.extractAndSaveContacts(
      tenantId,
      leadId,
      domain
    );
    return contactResults;
  },
  indexSite: async (tenantId: string, leadId: string) => {
    const { url } = await getLeadById(tenantId, leadId);

    // Add "Syncing Site" status when starting to index
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.SYNCING_SITE],
      [LEAD_STATUS.UNPROCESSED]
    );

    if (await LeadAnalyzerService.wasLastScrapeTooRecent(url.getFullDomain())) {
      await LeadAnalyzerService.analyze(tenantId, leadId);
      return;
    }

    // Add "Scraping Site" status when starting to scrape
    await updateLeadStatuses(
      tenantId,
      leadId,
      [LEAD_STATUS.SCRAPING_SITE],
      [LEAD_STATUS.SYNCING_SITE]
    );

    const metadata = {
      leadId,
      tenantId,
      type: firecrawlTypes.lead_site,
    };

    await SiteScrapeService.scrapeSite(url.cleanWebsiteUrl(), metadata, 'lead_site');
  },

  wasLastScrapeTooRecent: async (domain: string) => {
    const lastScrape = await EmbeddingsService.getDateOfLastDomainScrape(domain);

    if (!lastScrape) {
      return false;
    }

    const oneQuarterAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return lastScrape > oneQuarterAgo;
  },
};
