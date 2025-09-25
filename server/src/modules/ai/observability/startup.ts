import { logger } from '@/libs/logger';
import { langfuseService } from './langfuse.service';

/**
 * Initialize LangFuse observability on server startup
 * This should be called early in the server initialization process
 */
export async function initializeLangFuseObservability(): Promise<void> {
  try {
    logger.info('Initializing LangFuse observability...');
    
    if (!langfuseService.isReady()) {
      logger.info('LangFuse observability is disabled or not configured properly');
      return;
    }

    // Test connection and log initialization event
    langfuseService.logEvent('server_startup', {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'unknown',
    });

    logger.info('LangFuse observability initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize LangFuse observability:', error);
    // Don't throw - we want the server to continue starting even if LangFuse fails
  }
}

/**
 * Graceful shutdown of LangFuse services
 */
export async function shutdownLangFuseObservability(): Promise<void> {
  try {
    logger.info('Shutting down LangFuse observability...');
    
    if (langfuseService.isReady()) {
      // Log shutdown event
      langfuseService.logEvent('server_shutdown', {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
      });

      // Flush any pending events and shutdown
      await langfuseService.flush();
      await langfuseService.shutdown();
    }
    
    logger.info('LangFuse observability shutdown completed');
  } catch (error) {
    logger.error('Error during LangFuse shutdown:', error);
  }
}

/**
 * Health check for LangFuse integration
 */
export async function checkLangFuseHealth(): Promise<{
  isReady: boolean;
  clientAvailable: boolean;
  error?: string;
}> {
  try {
    const isReady = langfuseService.isReady();
    const clientAvailable = langfuseService.getClient() !== null;

    if (isReady && clientAvailable) {
      // Test basic functionality
      langfuseService.logEvent('health_check', {
        timestamp: new Date().toISOString(),
        status: 'healthy',
      });
    }

    return {
      isReady,
      clientAvailable,
    };
  } catch (error) {
    return {
      isReady: false,
      clientAvailable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}