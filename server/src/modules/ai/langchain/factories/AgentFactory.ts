import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { defaultLangChainConfig } from '../config/langchain.config';

// Create default agent instances
export const siteAnalysisAgent = new SiteAnalysisAgent(defaultLangChainConfig);
export const vendorFitAgent = new VendorFitAgent(defaultLangChainConfig);

// Factory functions
export const createSiteAnalysisAgent = (config = defaultLangChainConfig) => {
  return new SiteAnalysisAgent(config);
};

export const createVendorFitAgent = (config = defaultLangChainConfig) => {
  return new VendorFitAgent(config);
};

export function getContentFromMessage(message: any): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length > 0) {
    if (typeof message[0]?.text === 'string') return message[0].text;
    return JSON.stringify(message[0]);
  }
  if (typeof message === 'object' && message !== null) {
    if (typeof message.text === 'string') return message.text;
    if (typeof message.content === 'string') return message.content;
    return JSON.stringify(message);
  }
  return String(message);
}
