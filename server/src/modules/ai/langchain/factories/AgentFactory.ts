import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { ContactExtractionAgent } from '../agents/ContactExtractionAgent';
import { LeadQualificationAgent, type LeadQualificationInput } from '../agents/LeadQualificationAgent';
import { defaultLangChainConfig } from '../config/langchain.config';

// Create default agent instances
export const siteAnalysisAgent = new SiteAnalysisAgent(defaultLangChainConfig);
export const vendorFitAgent = new VendorFitAgent(defaultLangChainConfig);
export const contactExtractionAgent = new ContactExtractionAgent(defaultLangChainConfig);

// Lazy-loaded agent to avoid startup dependencies
let _leadQualificationAgent: LeadQualificationAgent | null = null;
export function getLeadQualificationAgent(): LeadQualificationAgent {
  if (!_leadQualificationAgent) {
    _leadQualificationAgent = new LeadQualificationAgent(defaultLangChainConfig);
  }
  return _leadQualificationAgent;
}

// Factory functions
export const createSiteAnalysisAgent = (config = defaultLangChainConfig) => {
  return new SiteAnalysisAgent(config);
};

export const createVendorFitAgent = (config = defaultLangChainConfig) => {
  return new VendorFitAgent(config);
};

export const createContactExtractionAgent = (config = defaultLangChainConfig) => {
  return new ContactExtractionAgent(config);
};

export const createLeadQualificationAgent = (config = defaultLangChainConfig) => {
  return new LeadQualificationAgent(config);
};
