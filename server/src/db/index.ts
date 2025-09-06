import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from './schema';
import { logger } from '@/libs/logger';

dotenv.config();

// Use individual environment variables like drizzle.config.ts
const dbConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  ssl: process.env.DB_DISABLE_SSL !== 'true',
};

// Use connection options object to avoid URL encoding issues
const client = postgres({
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  ssl: dbConfig.ssl,
  prepare: false, // Disable prefetch as it is not supported for "Transaction" pool mode
  onnotice: () => {}, // Suppress notice logs
  transform: {
    ...postgres.toCamel,
  },
});

const db = drizzle(client, { schema });

// Database connection cleanup function
export const shutdownDatabase = async (timeoutMs = 5000): Promise<void> => {
  try {
    logger.info('🔌 Shutting down database connections...');

    // End all connections with timeout
    await client.end({ timeout: Math.floor(timeoutMs / 1000) });

    logger.info('✅ Database connections closed successfully');
  } catch (error) {
    logger.error('❌ Error closing database connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export { db, client };
export * from './schema';
