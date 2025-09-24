import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { ContactExtractionAgent } from '../agents/ContactExtractionAgent';
import { ContactStrategyAgent } from '../agents/ContactStrategyAgent';
import { defaultLangChainConfig, LangChainConfig } from '../config/langchain.config';
import { logger } from '@/libs/logger';

// Create default agent instances with observability enabled
export const siteAnalysisAgent = new SiteAnalysisAgent({
  ...defaultLangChainConfig,
  enableTracing: true,
});

export const vendorFitAgent = new VendorFitAgent({
  ...defaultLangChainConfig,
  enableTracing: true,
});

export const contactExtractionAgent = new ContactExtractionAgent({
  ...defaultLangChainConfig,
  enableTracing: true,
});

export const contactStrategyAgent = new ContactStrategyAgent({
  ...defaultLangChainConfig,
  enableTracing: true,
});

// Enhanced factory functions with observability support
export const createSiteAnalysisAgent = (config: Partial<LangChainConfig> = {}) => {
  const finalConfig = {
    ...defaultLangChainConfig,
    enableTracing: true,
    ...config,
  };
  
  logger.debug('Creating SiteAnalysisAgent with config:', { 
    model: finalConfig.model,
    enableTracing: finalConfig.enableTracing 
  });
  
  return new SiteAnalysisAgent(finalConfig);
};

export const createVendorFitAgent = (config: Partial<LangChainConfig> = {}) => {
  const finalConfig = {
    ...defaultLangChainConfig,
    enableTracing: true,
    ...config,
  };
  
  logger.debug('Creating VendorFitAgent with config:', { 
    model: finalConfig.model,
    enableTracing: finalConfig.enableTracing 
  });
  
  return new VendorFitAgent(finalConfig);
};

export const createContactExtractionAgent = (config: Partial<LangChainConfig> = {}) => {
  const finalConfig = {
    ...defaultLangChainConfig,
    enableTracing: true,
    ...config,
  };
  
  logger.debug('Creating ContactExtractionAgent with config:', { 
    model: finalConfig.model,
    enableTracing: finalConfig.enableTracing 
  });
  
  return new ContactExtractionAgent(finalConfig);
};

export const createContactStrategyAgent = (config: Partial<LangChainConfig> = {}) => {
  const finalConfig = {
    ...defaultLangChainConfig,
    enableTracing: true,
    ...config,
  };
  
  logger.debug('Creating ContactStrategyAgent with config:', { 
    model: finalConfig.model,
    enableTracing: finalConfig.enableTracing 
  });
  
  return new ContactStrategyAgent(finalConfig);
};
