import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { ContactExtractionAgent } from '../agents/ContactExtractionAgent';
import { ContactStrategyAgent } from '../agents/ContactStrategyAgent';
import { defaultLangChainConfig } from '../config/langchain.config';

// Create default agent instances
export const siteAnalysisAgent = new SiteAnalysisAgent(defaultLangChainConfig);
export const vendorFitAgent = new VendorFitAgent(defaultLangChainConfig);
export const contactExtractionAgent = new ContactExtractionAgent(defaultLangChainConfig);
export const contactStrategyAgent = new ContactStrategyAgent(defaultLangChainConfig);

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

export const createContactStrategyAgent = (config = defaultLangChainConfig) => {
  return new ContactStrategyAgent(config);
};
