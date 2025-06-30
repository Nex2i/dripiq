import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  ssl: process.env.DB_DISABLE_SSL !== 'true',
};

if (process.env.DB_DISABLE_SSL === 'true') {
  dbConfig.ssl = false;
}

// Get schema name from environment or use default
const schemaName = process.env.DB_SCHEMA!;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    ...dbConfig,
  },
  schemaFilter: [schemaName],
  verbose: true,
  strict: true,
});
