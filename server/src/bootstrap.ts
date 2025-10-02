/**
 * Bootstrap / Initialization Module
 *
 * This file contains all side-effect imports and initialization logic
 * that must run before the application starts.
 *
 * Import this file FIRST in all entry points (server, workers, scripts, etc.)
 */

// Load environment variables first
import dotenv from 'dotenv';

// Initialize OpenTelemetry / Langfuse instrumentation
// Must be loaded before any LangChain or tracing code
import '@/libs/openTel';

// Load global extensions (String prototypes, etc.)
import '@/extensions';

dotenv.config();

// Export a no-op function to make the import explicit
export function bootstrap() {
  // This function intentionally does nothing
  // It exists to make the import side-effects explicit
}
