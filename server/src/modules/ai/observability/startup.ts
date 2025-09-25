import { logger } from '@/libs/logger';
import { langfuseService } from './langfuse.service';
import { promptService } from './prompt.service';

export interface ObservabilityStartupOptions {
  validatePrompts?: boolean;
  requiredPrompts?: string[];
  environment?: 'local' | 'prod';
}

export interface StartupResult {
  success: boolean;
  langfuse: {
    available: boolean;
    healthy: boolean;
    error?: string;
  };
  prompts: {
    available: boolean;
    validated: boolean;
    validatedCount?: number;
    errors?: string[];
  };
  errors: string[];
}

const DEFAULT_REQUIRED_PROMPTS = [
  'summarize_site',
  'vendor_fit', 
  'extract_contacts',
  'contact_strategy'
];

/**
 * Initialize and validate the observability system
 */
export async function initializeObservability(
  options: ObservabilityStartupOptions = {}
): Promise<StartupResult> {
  const result: StartupResult = {
    success: false,
    langfuse: {
      available: false,
      healthy: false,
    },
    prompts: {
      available: false,
      validated: false,
    },
    errors: [],
  };

  logger.info('Initializing observability system', options);

  try {
    // Initialize LangFuse service
    await initializeLangFuse(result);

    // Initialize Prompt service  
    await initializePromptService(result);

    // Validate required prompts if requested
    if (options.validatePrompts) {
      await validateRequiredPrompts(result, options);
    }

    // Determine overall success
    result.success = result.langfuse.available && result.prompts.available;

    if (result.success) {
      logger.info('Observability system initialized successfully', {
        langfuse: result.langfuse.healthy,
        prompts: result.prompts.validated,
        validatedPrompts: result.prompts.validatedCount,
      });
    } else {
      logger.warn('Observability system initialized with issues', {
        errors: result.errors,
        langfuse: result.langfuse,
        prompts: result.prompts,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Observability initialization failed: ${errorMessage}`);
    logger.error('Observability system initialization failed', error);
    return result;
  }
}

/**
 * Initialize LangFuse service
 */
async function initializeLangFuse(result: StartupResult): Promise<void> {
  try {
    await langfuseService.waitForInitialization();
    
    const healthStatus = langfuseService.getHealthStatus();
    result.langfuse.available = healthStatus.isAvailable;
    result.langfuse.healthy = healthStatus.isAvailable;

    if (!result.langfuse.available) {
      const error = 'LangFuse service is not available';
      result.langfuse.error = error;
      result.errors.push(error);
      logger.warn('LangFuse service initialization incomplete', healthStatus);
    } else {
      logger.info('LangFuse service initialized successfully', healthStatus);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.langfuse.error = errorMessage;
    result.errors.push(`LangFuse initialization failed: ${errorMessage}`);
    logger.error('LangFuse service initialization failed', error);
  }
}

/**
 * Initialize Prompt service
 */
async function initializePromptService(result: StartupResult): Promise<void> {
  try {
    await promptService.waitForInitialization();
    result.prompts.available = true;
    logger.info('Prompt service initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Prompt service initialization failed: ${errorMessage}`);
    logger.error('Prompt service initialization failed', error);
  }
}

/**
 * Validate that all required prompts are available
 */
async function validateRequiredPrompts(
  result: StartupResult, 
  options: ObservabilityStartupOptions
): Promise<void> {
  if (!result.prompts.available) {
    result.prompts.errors = ['Prompt service not available for validation'];
    return;
  }

  const requiredPrompts = options.requiredPrompts || DEFAULT_REQUIRED_PROMPTS;
  const environment = options.environment || (process.env.NODE_ENV === 'production' ? 'prod' : 'local');
  const errors: string[] = [];
  let validatedCount = 0;

  logger.info('Validating required prompts', { 
    promptCount: requiredPrompts.length, 
    environment 
  });

  for (const promptName of requiredPrompts) {
    try {
      const promptResult = await promptService.getPrompt(promptName, { environment });
      
      if (!promptResult.prompt || promptResult.prompt.trim().length === 0) {
        const error = `Prompt '${promptName}' is empty`;
        errors.push(error);
        logger.warn('Empty prompt detected', { promptName, environment });
      } else {
        validatedCount++;
        logger.debug('Prompt validated successfully', { 
          promptName, 
          environment,
          version: promptResult.version,
          length: promptResult.prompt.length,
          cached: promptResult.cached 
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullError = `Failed to validate prompt '${promptName}': ${errorMessage}`;
      errors.push(fullError);
      logger.error('Prompt validation failed', { promptName, environment, error });
    }
  }

  result.prompts.validated = errors.length === 0;
  result.prompts.validatedCount = validatedCount;
  result.prompts.errors = errors.length > 0 ? errors : undefined;

  if (errors.length > 0) {
    result.errors.push(...errors);
    logger.warn('Prompt validation completed with errors', { 
      totalPrompts: requiredPrompts.length,
      validatedCount,
      errorCount: errors.length 
    });
  } else {
    logger.info('All required prompts validated successfully', { 
      totalPrompts: requiredPrompts.length,
      environment 
    });
  }
}

/**
 * Get the current health status of the observability system
 */
export function getObservabilityHealthStatus(): {
  langfuse: ReturnType<typeof langfuseService.getHealthStatus>;
  prompts: {
    available: boolean;
    cacheStats: ReturnType<typeof promptService.getCacheStats>;
  };
  overall: {
    healthy: boolean;
    lastCheck: string;
  };
} {
  const langfuseHealth = langfuseService.getHealthStatus();
  const promptCacheStats = promptService.getCacheStats();

  return {
    langfuse: langfuseHealth,
    prompts: {
      available: true, // Prompt service is always available
      cacheStats: promptCacheStats,
    },
    overall: {
      healthy: langfuseHealth.isAvailable,
      lastCheck: new Date().toISOString(),
    },
  };
}

/**
 * Gracefully shutdown the observability system
 */
export async function shutdownObservability(): Promise<void> {
  logger.info('Shutting down observability system');

  try {
    // Clear prompt cache
    promptService.clearCache();
    logger.info('Prompt cache cleared');

    // Shutdown LangFuse
    await langfuseService.shutdown();
    logger.info('LangFuse service shutdown completed');

    logger.info('Observability system shutdown completed successfully');
  } catch (error) {
    logger.error('Error during observability system shutdown', error);
    throw error;
  }
}

/**
 * Flush all pending observability data
 */
export async function flushObservabilityData(): Promise<void> {
  logger.debug('Flushing observability data');

  try {
    await langfuseService.flush();
    logger.debug('LangFuse data flushed successfully');
  } catch (error) {
    logger.error('Error flushing observability data', error);
    throw error;
  }
}