/**
 * CoreSignal WebData Client
 *
 * Provides access to CoreSignal API for employee and company data retrieval
 * with built-in caching, error handling, and comprehensive search functionality.
 */

// Create and export a singleton instance
import { CoreSignalClient } from './coresignal.client';

export { CoreSignalClient } from './coresignal.client';
export * from './types';

let coreSignalInstance: CoreSignalClient | null = null;

/**
 * Get singleton CoreSignal client instance
 * Lazy initialization to avoid creating instance during module imports
 */
export function getCoreSignalClient(): CoreSignalClient {
  if (!coreSignalInstance) {
    coreSignalInstance = new CoreSignalClient();
  }
  return coreSignalInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetCoreSignalClient(): void {
  coreSignalInstance = null;
}
