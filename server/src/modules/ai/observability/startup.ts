import { logger } from '@/libs/logger';
import { migrationService } from './migration.service';

/**
 * Initialize LangFuse observability on server startup
 * This should be called early in the server initialization process
 */
export async function initializeLangFuseObservability(): Promise<void> {
  try {
    logger.info('Initializing LangFuse observability...');
    
    // Run health check first
    const healthCheck = await migrationService.healthCheck();
    
    if (!healthCheck.isReady) {
      logger.info('LangFuse observability is disabled or not configured properly', {
        clientAvailable: healthCheck.clientAvailable,
        error: healthCheck.error,
      });
      return;
    }

    // Initialize observability
    await migrationService.initializeObservability();
    
    // Only run migration in development or when explicitly requested
    const shouldMigrate = process.env.LANGFUSE_MIGRATE_PROMPTS === 'true' || 
                         process.env.NODE_ENV === 'development';
    
    if (shouldMigrate) {
      logger.info('Migrating prompts to LangFuse...');
      await migrationService.migratePrompts();
    }

    // Only create datasets in development or when explicitly requested
    const shouldCreateDatasets = process.env.LANGFUSE_CREATE_DATASETS === 'true' || 
                                 process.env.NODE_ENV === 'development';
    
    if (shouldCreateDatasets) {
      logger.info('Creating evaluation datasets...');
      await migrationService.createEvaluationDatasets();
      await migrationService.seedEvaluationData();
    }

    logger.info('LangFuse observability initialization completed successfully');
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
    
    const { langfuseService } = await import('./langfuse.service');
    await langfuseService.shutdown();
    
    logger.info('LangFuse observability shutdown completed');
  } catch (error) {
    logger.error('Error during LangFuse shutdown:', error);
  }
}