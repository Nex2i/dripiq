import { logger } from '@/libs/logger';
import { LangFuseService, LangFuseConfig, createLangFuseService } from './langfuse.service';
import { PromptService, createPromptService } from './prompt.service';

// Re-export core services and types
export {
  LangFuseService,
  createLangFuseService,
  type LangFuseConfig,
  type TraceMetadata,
  type AgentExecutionContext,
  type TraceResult,
} from './langfuse.service';

export {
  PromptService,
  createPromptService,
  type PromptConfig,
  type PromptResult,
  type PromptCache,
  type PromptName,
} from './prompt.service';

export {
  type EnhancedAgentResult,
  type AgentExecutionOptions,
  type AgentTraceMetadata,
} from './types';

// Simple observability services interface
export interface ObservabilityServices {
  langfuseService: LangFuseService;
  promptService: PromptService;
}

// Singleton services instance
let servicesInstance: ObservabilityServices | null = null;

/**
 * Load LangFuse configuration from environment variables
 */
function loadLangFuseConfig(): LangFuseConfig {
  const config: LangFuseConfig = {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey: process.env.LANGFUSE_SECRET_KEY || '',
    host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    enabled: process.env.LANGFUSE_ENABLED === 'true',
    debug: process.env.LANGFUSE_DEBUG === 'true',
    flushAt: process.env.LANGFUSE_FLUSH_AT ? parseInt(process.env.LANGFUSE_FLUSH_AT, 10) : 10,
    flushInterval: process.env.LANGFUSE_FLUSH_INTERVAL
      ? parseInt(process.env.LANGFUSE_FLUSH_INTERVAL, 10)
      : 1000,
  };

  // Validate required configuration
  const requiredFields = ['publicKey', 'secretKey', 'host'];
  const missingFields = requiredFields.filter((field) => !config[field as keyof LangFuseConfig]);

  if (config.enabled && missingFields.length > 0) {
    logger.warn('LangFuse enabled but missing required configuration', {
      missingFields,
      enabled: config.enabled,
    });
  }

  logger.debug('LangFuse configuration loaded', {
    enabled: config.enabled,
    host: config.host,
    debug: config.debug,
    flushAt: config.flushAt,
    flushInterval: config.flushInterval,
    hasPublicKey: !!config.publicKey,
    hasSecretKey: !!config.secretKey,
  });

  return config;
}

/**
 * Initialize observability services (creates singleton instance)
 */
export async function initializeObservability(): Promise<ObservabilityServices> {
  if (servicesInstance) {
    logger.debug('Observability services already initialized');
    return servicesInstance;
  }

  logger.info('Initializing observability services...');

  try {
    // Load configuration from environment
    const config = loadLangFuseConfig();

    // Initialize LangFuse service
    const langfuseService = createLangFuseService(config);

    // Initialize Prompt service
    const promptService = createPromptService(langfuseService);

    servicesInstance = {
      langfuseService,
      promptService,
    };

    // Log initialization status
    if (langfuseService.isAvailable()) {
      logger.info('All observability services initialized successfully');
    } else {
      logger.warn('LangFuse service not available - some features will be limited');
    }

    return servicesInstance;
  } catch (error) {
    logger.error('Failed to initialize observability services', error);
    throw new Error(
      `Observability initialization failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Get observability services (initializes if needed)
 */
export async function getObservabilityServices(): Promise<ObservabilityServices> {
  if (!servicesInstance) {
    return initializeObservability();
  }
  return servicesInstance;
}

/**
 * Check if observability services are initialized
 */
export function isObservabilityReady(): boolean {
  return servicesInstance !== null;
}

/**
 * Get current LangFuse service status
 */
export function getLangFuseStatus(): {
  initialized: boolean;
  available: boolean;
  config?: Partial<LangFuseConfig>;
} {
  if (!servicesInstance) {
    return { initialized: false, available: false };
  }

  return {
    initialized: true,
    available: servicesInstance.langfuseService.isAvailable(),
    config: servicesInstance.langfuseService.getConfig(),
  };
}

/**
 * Gracefully shutdown observability services
 */
export async function shutdownObservability(): Promise<void> {
  if (!servicesInstance) {
    logger.debug('Observability services not initialized, nothing to shutdown');
    return;
  }

  logger.info('Shutting down observability services...');

  try {
    // Shutdown LangFuse service
    await servicesInstance.langfuseService.shutdown();

    // Clear prompt cache
    servicesInstance.promptService.clearCache();

    servicesInstance = null;

    logger.info('Observability services shutdown successfully');
  } catch (error) {
    logger.error('Error during observability services shutdown', error);
    throw error;
  }
}
