#!/usr/bin/env node

/**
 * Centralized Worker Runner
 *
 * This script starts all BullMQ workers for the application.
 * It can be run standalone to process background jobs without starting the main server.
 *
 * Usage:
 *   npm run workers        # Start all workers
 *   tsx src/workers/worker.run.ts  # Direct execution
 */

import { logger } from '@/libs/logger';
import { createRedisConnection } from '@/libs/bullmq';
import { leadAnalysisWorker, campaignCreationWorker, campaignExecutionWorker } from './index';

// Track active workers for graceful shutdown
// Note: timeout processing is handled within campaignExecutionWorker
const activeWorkers = [leadAnalysisWorker, campaignCreationWorker, campaignExecutionWorker];

async function startWorkers() {
  try {
    // Test Redis connection first
    const redis = createRedisConnection();
    await redis.ping();
    logger.info('✅ Redis connection established');

    // Log worker startup
    logger.info('🚀 Starting BullMQ workers...', {
      workers: [
        'lead-analysis',
        'campaign-creation',
        'campaign-execution (includes timeout processing)',
      ],
      timestamp: new Date().toISOString(),
    });

    // Workers are automatically started when imported
    // Just log their status
    logger.info('✅ All workers started successfully', {
      leadAnalysisWorker: leadAnalysisWorker.isRunning(),
      campaignCreationWorker: campaignCreationWorker.isRunning(),
      campaignExecutionWorker: campaignExecutionWorker.isRunning(),
    });

    // Keep the process alive
    logger.info('📊 Workers are running. Press Ctrl+C to stop...');
  } catch (error) {
    logger.error('❌ Failed to start workers', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close all workers
    await Promise.all(
      activeWorkers.map(async (worker, index) => {
        const workerNames = ['lead-analysis', 'campaign-creation', 'campaign-execution'];
        logger.info(`🛑 Closing ${workerNames[index]} worker...`);
        await worker.close();
        logger.info(`✅ ${workerNames[index]} worker closed`);
      })
    );

    logger.info('✅ All workers shut down gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught exception in worker process', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled rejection in worker process', {
    reason: String(reason),
    promise: String(promise),
  });
  gracefulShutdown('unhandledRejection');
});

// Start the workers
if (require.main === module) {
  startWorkers();
}

export { startWorkers, gracefulShutdown };
