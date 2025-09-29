import { logger } from '@/libs/logger';
import { SiteAnalysisAgent } from '../agents/SiteAnalysisAgent';
import { VendorFitAgent } from '../agents/VendorFitAgent';
import { ContactExtractionAgent } from '../agents/ContactExtractionAgent';
import { ContactStrategyAgent } from '../agents/ContactStrategyAgent';
import { defaultLangChainConfig } from '../config/langchain.config';

/**
 * LangFuse-First Agent Factory
 *
 * All agents now require LangFuse observability services to be available.
 * These factory functions create agents that will fail fast if observability
 * is not properly configured.
 *
 * NOTE: The singleton instances below are provided for convenience but
 * should only be used after ensuring observability services are initialized.
 */

// Create default agent instances (use with caution - ensure observability is initialized)
export const siteAnalysisAgent = new SiteAnalysisAgent(defaultLangChainConfig);
export const vendorFitAgent = new VendorFitAgent(defaultLangChainConfig);
export const contactExtractionAgent = new ContactExtractionAgent(defaultLangChainConfig);
export const contactStrategyAgent = new ContactStrategyAgent(defaultLangChainConfig);

// Factory functions for creating new agent instances
export const createSiteAnalysisAgent = (config = defaultLangChainConfig): SiteAnalysisAgent => {
  logger.debug('Creating SiteAnalysisAgent with LangFuse-first configuration');
  return new SiteAnalysisAgent(config);
};

export const createVendorFitAgent = (config = defaultLangChainConfig): VendorFitAgent => {
  logger.debug('Creating VendorFitAgent with LangFuse-first configuration');
  return new VendorFitAgent(config);
};

export const createContactExtractionAgent = (
  config = defaultLangChainConfig
): ContactExtractionAgent => {
  logger.debug('Creating ContactExtractionAgent with LangFuse-first configuration');
  return new ContactExtractionAgent(config);
};

export const createContactStrategyAgent = (
  config = defaultLangChainConfig
): ContactStrategyAgent => {
  logger.debug('Creating ContactStrategyAgent with LangFuse-first configuration');
  return new ContactStrategyAgent(config);
};

/**
 * Initialize all default agents and verify observability is available
 * Call this during application startup to ensure everything is properly configured
 */
export const initializeAgents = async (): Promise<void> => {
  logger.info('Initializing LangFuse-first AI agents...');

  try {
    // Import here to avoid circular dependencies
    const { getObservabilityServices } = await import('../../observability');
    const services = await getObservabilityServices();

    if (!services.langfuseService.isAvailable()) {
      throw new Error('LangFuse service is not available');
    }

    logger.info('AI agents initialized successfully with LangFuse observability');
  } catch (error) {
    logger.error('Failed to initialize AI agents', error);
    throw new Error(
      `AI agent initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Please ensure LangFuse is properly configured before using AI agents.'
    );
  }
};
