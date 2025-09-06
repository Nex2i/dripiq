/**
 * Centralized Shutdown Utilities
 * 
 * This module provides utilities for gracefully shutting down various
 * components of the application including database connections, Redis
 * connections, and HTTP servers.
 */

import { logger } from '@/libs/logger';
import { shutdownDatabase } from '@/db';
import { shutdownQueues } from '@/libs/bullmq';

export interface ShutdownOptions {
  /** Timeout in milliseconds for shutdown operations */
  timeout?: number;
  /** Whether to force exit after timeout */
  forceExit?: boolean;
}

/**
 * Gracefully shutdown database connections
 */
export async function shutdownDatabaseConnections(options: ShutdownOptions = {}): Promise<void> {
  const { timeout = 5000 } = options;
  
  try {
    logger.info('🔄 Shutting down database connections...');
    await shutdownDatabase(timeout);
    logger.info('✅ Database connections closed');
  } catch (error) {
    logger.error('❌ Error closing database connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Gracefully shutdown Redis/BullMQ connections
 */
export async function shutdownRedisConnections(): Promise<void> {
  try {
    logger.info('🔄 Shutting down Redis connections...');
    await shutdownQueues();
    logger.info('✅ Redis connections closed');
  } catch (error) {
    logger.error('❌ Error closing Redis connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Gracefully shutdown HTTP server
 */
export async function shutdownHttpServer(server: any): Promise<void> {
  if (!server) return;
  
  try {
    logger.info('🛑 Closing HTTP server...');
    await server.close();
    logger.info('✅ HTTP server closed');
  } catch (error) {
    logger.error('❌ Error closing HTTP server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Gracefully shutdown all application components
 */
export async function shutdownAll(server?: any, options: ShutdownOptions = {}): Promise<void> {
  const { timeout = 10000, forceExit = true } = options;
  
  const shutdownPromise = async () => {
    const errors: Error[] = [];

    // Shutdown HTTP server first to stop accepting new requests
    if (server) {
      try {
        await shutdownHttpServer(server);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Shutdown Redis connections
    try {
      await shutdownRedisConnections();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Shutdown database connections last
    try {
      await shutdownDatabaseConnections({ timeout: Math.floor(timeout / 2) });
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    if (errors.length > 0) {
      logger.error(`❌ ${errors.length} error(s) occurred during shutdown`, {
        errors: errors.map(e => e.message),
      });
      throw new Error(`Shutdown completed with ${errors.length} error(s)`);
    }
  };

  // Apply timeout to the entire shutdown process
  if (timeout > 0) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      await Promise.race([shutdownPromise(), timeoutPromise]);
    } catch (error) {
      logger.error('❌ Shutdown failed or timed out', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeout,
      });
      
      if (forceExit) {
        logger.warn('⚠️ Force exiting due to shutdown timeout');
        process.exit(1);
      }
      throw error;
    }
  } else {
    await shutdownPromise();
  }
}

/**
 * Create a graceful shutdown handler for process signals
 */
export function createGracefulShutdownHandler(
  server?: any,
  options: ShutdownOptions = {}
) {
  return async (signal: string) => {
    logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);

    try {
      await shutdownAll(server, options);
      logger.info('✅ Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
        signal,
      });
      process.exit(1);
    }
  };
}

/**
 * Setup graceful shutdown handlers for common process signals
 */
export function setupGracefulShutdown(
  server?: any,
  options: ShutdownOptions = {}
): void {
  const shutdownHandler = createGracefulShutdownHandler(server, options);

  // Handle termination signals
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    shutdownHandler('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled rejection', {
      reason: String(reason),
      promise: String(promise),
    });
    shutdownHandler('unhandledRejection');
  });

  logger.info('📋 Graceful shutdown handlers registered');
}