import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { ContactExtractionAgent } from '../agents/ContactExtractionAgent';
import { ContactStrategyAgent } from '../agents/ContactStrategyAgent';
import { defaultLangChainConfig } from '../config/langchain.config';
import { SmartUrlFilterAgent } from '../agents/SmartUrlFilterAgent';

// Create default agent instances
export const siteAnalysisAgent = new SiteAnalysisAgent(defaultLangChainConfig);
export const contactExtractionAgent = new ContactExtractionAgent(defaultLangChainConfig);
export const contactStrategyAgent = new ContactStrategyAgent(defaultLangChainConfig);
export const smartUrlFilterAgent = new SmartUrlFilterAgent(defaultLangChainConfig);

// Factory functions
export const createSiteAnalysisAgent = (config = defaultLangChainConfig) => {
  return new SiteAnalysisAgent(config);
};

export const createContactExtractionAgent = (config = defaultLangChainConfig) => {
  return new ContactExtractionAgent(config);
};

export const createContactStrategyAgent = (config = defaultLangChainConfig) => {
  return new ContactStrategyAgent(config);
};

export const createSmartUrlFilterAgent = (config = defaultLangChainConfig) => {
  return new SmartUrlFilterAgent(config);
};
