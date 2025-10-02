import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { ContactExtractionAgent } from '../agents/ContactExtractionAgent';
import { ContactStrategyAgent } from '../agents/ContactStrategyAgent';
import {
  defaultLangChainConfig,
  defaultLowIntelligenceLangchainConfig,
} from '../config/langchain.config';
import { SmartUrlFilterAgent } from '../agents/SmartUrlFilterAgent';

// Create default agent instances
export const siteAnalysisAgent = new SiteAnalysisAgent(defaultLangChainConfig);
export const vendorFitAgent = new VendorFitAgent(defaultLangChainConfig);
export const contactExtractionAgent = new ContactExtractionAgent(defaultLangChainConfig);
export const contactStrategyAgent = new ContactStrategyAgent(defaultLangChainConfig);
export const smartUrlFilterAgent = new SmartUrlFilterAgent(defaultLowIntelligenceLangchainConfig);

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

export const createSmartUrlFilterAgent = (config = defaultLowIntelligenceLangchainConfig) => {
  return new SmartUrlFilterAgent(config);
};
