import { LangFuseService, LangFuseConfig, createLangFuseService } from './langfuse.service';
import { PromptService, createPromptService } from './prompt.service';
import { logger } from '@/libs/logger';

export interface ObservabilityServices {
  langfuseService: LangFuseService;
  promptService: PromptService;
}

export interface HealthCheck {
  service: string;
  healthy: boolean;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Observability Startup Module
 * 
 * Handles initialization, configuration, and health checks for all observability services.
 * Provides centralized service management and graceful degradation.
 */
export class ObservabilityStartup {
  private services: ObservabilityServices | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize all observability services
   */
  public async initialize(): Promise<ObservabilityServices> {
    if (this.isInitialized && this.services) {
      logger.debug('Observability services already initialized');
      return this.services;
    }

    logger.info('Initializing observability services...');

    try {
      // Load configuration from environment
      const config = this.loadConfiguration();
      
      // Initialize LangFuse service
      const langfuseService = createLangFuseService(config);
      
      // Initialize Prompt service
      const promptService = createPromptService(langfuseService);

      this.services = {
        langfuseService,
        promptService,
      };

      this.isInitialized = true;

      // Perform health checks
      const healthChecks = await this.performHealthChecks();
      const unhealthyServices = healthChecks.filter(check => !check.healthy);

      if (unhealthyServices.length > 0) {
        logger.warn('Some observability services are unhealthy', {
          unhealthyServices: unhealthyServices.map(s => s.service),
          checks: healthChecks,
        });
      } else {
        logger.info('All observability services initialized successfully');
      }

      return this.services;
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
   * Get initialized services (throws if not initialized)
   */
  public getServices(): ObservabilityServices {
    if (!this.isInitialized || !this.services) {
      throw new Error('Observability services not initialized. Call initialize() first.');
    }
    return this.services;
  }

  /**
   * Check if services are initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.services !== null;
  }

  /**
   * Perform health checks on all services
   */
  public async performHealthChecks(): Promise<HealthCheck[]> {
    if (!this.isReady()) {
      return [{
        service: 'observability',
        healthy: false,
        message: 'Services not initialized',
      }];
    }

    const checks: HealthCheck[] = [];
    const { langfuseService, promptService } = this.services!;

    // LangFuse health check
    try {
      const isAvailable = langfuseService.isAvailable();
      const config = langfuseService.getConfig();
      
      checks.push({
        service: 'langfuse',
        healthy: isAvailable,
        message: isAvailable ? 'Connected' : 'Not available',
        details: {
          enabled: config.enabled,
          host: config.host,
          debug: config.debug,
        },
      });
    } catch (error) {
      checks.push({
        service: 'langfuse',
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Prompt service health check
    try {
      const cacheStats = promptService.getCacheStats();
      checks.push({
        service: 'prompt',
        healthy: true,
        message: 'Ready',
        details: {
          cacheEntries: cacheStats.totalEntries,
          expiredEntries: cacheStats.entries.filter(e => e.expired).length,
        },
      });
    } catch (error) {
      checks.push({
        service: 'prompt',
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return checks;
  }

  /**
   * Gracefully shutdown all services
   */
  public async shutdown(): Promise<void> {
    if (!this.isReady()) {
      logger.debug('Observability services not initialized, nothing to shutdown');
      return;
    }

    logger.info('Shutting down observability services...');

    try {
      // Shutdown LangFuse service
      await this.services!.langfuseService.shutdown();

      // Clear prompt cache
      this.services!.promptService.clearCache();

      this.services = null;
      this.isInitialized = false;

      logger.info('Observability services shutdown successfully');
    } catch (error) {
      logger.error('Error during observability services shutdown', error);
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): LangFuseConfig {
    const config: LangFuseConfig = {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
      secretKey: process.env.LANGFUSE_SECRET_KEY || '',
      host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
      enabled: process.env.LANGFUSE_ENABLED === 'true',
      debug: process.env.LANGFUSE_DEBUG === 'true',
      flushAt: process.env.LANGFUSE_FLUSH_AT ? parseInt(process.env.LANGFUSE_FLUSH_AT, 10) : 10,
      flushInterval: process.env.LANGFUSE_FLUSH_INTERVAL ? parseInt(process.env.LANGFUSE_FLUSH_INTERVAL, 10) : 1000,
    };

    // Validate required configuration
    const requiredFields = ['publicKey', 'secretKey', 'host'];
    const missingFields = requiredFields.filter(field => !config[field as keyof LangFuseConfig]);

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
}

// Create and export singleton instance
export const observabilityStartup = new ObservabilityStartup();

/**
 * Convenience function for quick initialization
 */
export const initializeObservability = async (): Promise<ObservabilityServices> => {
  return observabilityStartup.initialize();
};

/**
 * Convenience function to get services (initializes if needed)
 */
export const getObservabilityServices = async (): Promise<ObservabilityServices> => {
  if (!observabilityStartup.isReady()) {
    return observabilityStartup.initialize();
  }
  return observabilityStartup.getServices();
};