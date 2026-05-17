/**
 * WebData Service
 *
 * Unified interface for employee and company data retrieval from multiple providers.
 * Supports CoreSignal (fallback) and ZoomInfo when configured per tenant.
 */

// Create and export singleton instances
import { tenantZoominfoCredentialsRepository } from '@/repositories';
import { WebDataService } from './webData.service';
import { CoreSignalClient } from './coresignal.client';
import { ZoomInfoWebDataProvider } from './providers/zoominfo.provider';

// Export the main service interface and types
export { WebDataService } from './webData.service';
export * from './interfaces/webData.interface';

// Export specific providers for advanced usage
export { CoreSignalWebDataProvider } from './providers/coresignal.provider';
export { ZoomInfoWebDataProvider } from './providers/zoominfo.provider';
export { CoreSignalClient } from './coresignal.client';
export * from './types';

let webDataServiceInstance: WebDataService | null = null;
let coreSignalInstance: CoreSignalClient | null = null;

/**
 * Get singleton WebDataService instance (RECOMMENDED)
 * This is the main entry point for all web data operations
 */
export function getWebDataService(): WebDataService {
  if (!webDataServiceInstance) {
    webDataServiceInstance = new WebDataService('coresignal');
  }
  return webDataServiceInstance;
}

/**
 * Resolves CoreSignal or ZoomInfo for the tenant when ZoomInfo credentials exist.
 */
export async function getWebDataServiceForTenant(tenantId: string): Promise<WebDataService> {
  const configured = await tenantZoominfoCredentialsRepository.findByTenantId(tenantId);
  if (configured) {
    return new WebDataService('custom', new ZoomInfoWebDataProvider(tenantId));
  }
  return getWebDataService();
}

/**
 * Get singleton CoreSignal client instance (LEGACY)
 * Use getWebDataService() instead for new implementations
 */
export function getCoreSignalClient(): CoreSignalClient {
  if (!coreSignalInstance) {
    coreSignalInstance = new CoreSignalClient();
  }
  return coreSignalInstance;
}

/**
 * Reset singleton instances (useful for testing)
 */
export function resetWebDataService(): void {
  webDataServiceInstance = null;
}

export function resetCoreSignalClient(): void {
  coreSignalInstance = null;
}

/**
 * Reset all singleton instances
 */
export function resetAll(): void {
  resetWebDataService();
  resetCoreSignalClient();
}
