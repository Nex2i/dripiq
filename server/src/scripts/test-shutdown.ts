#!/usr/bin/env tsx

/**
 * Test Script for Connection Shutdown
 * 
 * This script tests the database and Redis connection cleanup functionality.
 * Run with: tsx src/scripts/test-shutdown.ts
 */

import { logger } from '@/libs/logger';
import { db } from '@/db';
import { createRedisConnection } from '@/libs/bullmq';
import { shutdownAll } from '@/libs/shutdown';

async function testConnections() {
  logger.info('🧪 Testing connection cleanup...');

  try {
    // Test database connection
    logger.info('📊 Testing database connection...');
    const result = await db.execute('SELECT 1 as test');
    logger.info('✅ Database connection working', { result: result.rows });

    // Test Redis connection
    logger.info('📡 Testing Redis connection...');
    const redis = createRedisConnection();
    const pong = await redis.ping();
    logger.info('✅ Redis connection working', { pong });

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test shutdown
    logger.info('🔄 Testing graceful shutdown...');
    await shutdownAll(null, { timeout: 5000 });
    
    logger.info('✅ Shutdown test completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Shutdown test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testConnections();
}