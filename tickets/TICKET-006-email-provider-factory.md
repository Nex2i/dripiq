# TICKET-006: Create Email Provider Factory

## **Priority:** High
## **Estimated Time:** 2-3 days
## **Phase:** 2 - Provider Factory and Base Implementation
## **Dependencies:** TICKET-005

---

## **Description**
Create a factory class responsible for creating, caching, and managing email provider instances. The factory will handle provider instantiation, configuration loading, caching for performance, and provider lifecycle management.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `EmailProviderFactory` class with provider creation logic
- [ ] Implement provider caching for performance
- [ ] Support dynamic provider configuration loading from database
- [ ] Include error handling for invalid configurations
- [ ] Implement provider cleanup and cache management
- [ ] Support getting providers by tenant and sender identity

### **Should Have**
- [ ] Provider health checking and failover logic
- [ ] Configuration validation before provider creation
- [ ] Metrics collection for provider usage
- [ ] Thread-safe provider caching

### **Could Have**
- [ ] Provider warm-up strategies
- [ ] Configuration hot-reloading
- [ ] Provider performance monitoring

## **Technical Requirements**

### **File Location**
```
server/src/libs/email/EmailProviderFactory.ts
```

### **Core Implementation**

```typescript
import type { EmailProvider } from './providers/EmailProvider.interface';
import type { ProviderConfig, EmailProviderType } from './types/EmailConfig.types';
import { SendGridProvider } from './providers/SendGridProvider';
import { SMTPProvider } from './providers/SMTPProvider';
import { MicrosoftGraphProvider } from './providers/MicrosoftGraphProvider';
import { GoogleWorkspaceProvider } from './providers/GoogleWorkspaceProvider';
import { EmailProviderError, EMAIL_ERROR_CODES } from './types/EmailErrors.types';
import { logger } from '@/libs/logger';

export class EmailProviderFactory {
  private static providers = new Map<string, EmailProvider>();
  private static configCache = new Map<string, ProviderConfig>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Create a new provider instance from configuration
   */
  static async createProvider(config: ProviderConfig): Promise<EmailProvider> {
    const cacheKey = this.getCacheKey(config.tenantId, config.id || config.name);
    
    // Check cache first
    if (this.providers.has(cacheKey)) {
      const provider = this.providers.get(cacheKey)!;
      
      // Validate cached provider is still healthy
      if (await this.isProviderHealthy(provider)) {
        return provider;
      } else {
        // Remove unhealthy provider from cache
        this.providers.delete(cacheKey);
      }
    }
    
    // Validate configuration
    this.validateConfig(config);
    
    // Create new provider instance
    let provider: EmailProvider;
    
    try {
      switch (config.type) {
        case 'sendgrid':
          provider = new SendGridProvider(config);
          break;
        case 'smtp':
          provider = new SMTPProvider(config);
          break;
        case 'microsoft_graph':
          provider = new MicrosoftGraphProvider(config);
          break;
        case 'google_workspace':
          provider = new GoogleWorkspaceProvider(config);
          break;
        default:
          throw new EmailProviderError(
            `Unsupported provider type: ${(config as any).type}`,
            EMAIL_ERROR_CODES.PROVIDER_NOT_FOUND,
            400,
            'factory'
          );
      }
      
      // Initialize provider if needed
      if (provider.initialize) {
        await provider.initialize();
      }
      
      // Test connection to ensure provider is working
      const connectionTest = await provider.testConnection();
      if (!connectionTest.success) {
        throw new EmailProviderError(
          `Provider connection test failed: ${connectionTest.error}`,
          EMAIL_ERROR_CODES.CONNECTION_FAILED,
          503,
          config.type,
          { testResult: connectionTest }
        );
      }
      
      // Cache the working provider
      this.providers.set(cacheKey, provider);
      
      logger.info('[EmailProviderFactory] Provider created successfully', {
        providerType: config.type,
        tenantId: config.tenantId,
        configId: config.id,
        configName: config.name,
        capabilities: provider.capabilities,
      });
      
      return provider;
    } catch (error) {
      logger.error('[EmailProviderFactory] Failed to create provider', {
        providerType: config.type,
        tenantId: config.tenantId,
        configId: config.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      if (error instanceof EmailProviderError) {
        throw error;
      }
      
      throw new EmailProviderError(
        `Failed to create ${config.type} provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
        500,
        config.type,
        { originalError: error }
      );
    }
  }
  
  /**
   * Get provider for a specific tenant (uses default or specified provider)
   */
  static async getProviderForTenant(
    tenantId: string, 
    providerName?: string
  ): Promise<EmailProvider> {
    try {
      const config = await this.getProviderConfig(tenantId, providerName);
      return this.createProvider(config);
    } catch (error) {
      logger.error('[EmailProviderFactory] Failed to get provider for tenant', {
        tenantId,
        providerName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
  
  /**
   * Get provider for a specific sender identity
   */
  static async getProviderForSenderIdentity(
    senderIdentityId: string,
    tenantId: string
  ): Promise<EmailProvider> {
    try {
      const config = await this.getProviderConfigForSender(senderIdentityId, tenantId);
      return this.createProvider(config);
    } catch (error) {
      logger.error('[EmailProviderFactory] Failed to get provider for sender identity', {
        senderIdentityId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
  
  /**
   * Get all available providers for a tenant
   */
  static async getAvailableProviders(tenantId: string): Promise<EmailProvider[]> {
    const configs = await this.getAllProviderConfigs(tenantId);
    const providers: EmailProvider[] = [];
    
    for (const config of configs) {
      try {
        const provider = await this.createProvider(config);
        providers.push(provider);
      } catch (error) {
        logger.warn('[EmailProviderFactory] Skipping unavailable provider', {
          providerType: config.type,
          configId: config.id,
          tenantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return providers;
  }
  
  /**
   * Test all providers for a tenant
   */
  static async testAllProviders(tenantId: string): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const providers = await this.getAvailableProviders(tenantId);
    
    await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const result = await provider.testConnection();
          results.set(provider.config.name, result.success);
        } catch (error) {
          results.set(provider.config.name, false);
        }
      })
    );
    
    return results;
  }
  
  /**
   * Clear provider cache
   */
  static clearCache(tenantId?: string, configId?: string): void {
    if (tenantId && configId) {
      // Clear specific provider
      const cacheKey = this.getCacheKey(tenantId, configId);
      const provider = this.providers.get(cacheKey);
      
      if (provider && provider.cleanup) {
        provider.cleanup().catch((error) => {
          logger.warn('[EmailProviderFactory] Provider cleanup failed', {
            tenantId,
            configId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
      
      this.providers.delete(cacheKey);
      this.configCache.delete(cacheKey);
    } else if (tenantId) {
      // Clear all providers for tenant
      const keysToDelete: string[] = [];
      
      for (const [key, provider] of this.providers) {
        if (key.startsWith(`${tenantId}-`)) {
          keysToDelete.push(key);
          
          if (provider.cleanup) {
            provider.cleanup().catch((error) => {
              logger.warn('[EmailProviderFactory] Provider cleanup failed', {
                tenantId,
                cacheKey: key,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            });
          }
        }
      }
      
      keysToDelete.forEach((key) => {
        this.providers.delete(key);
        this.configCache.delete(key);
      });
    } else {
      // Clear all providers
      for (const [key, provider] of this.providers) {
        if (provider.cleanup) {
          provider.cleanup().catch((error) => {
            logger.warn('[EmailProviderFactory] Provider cleanup failed', {
              cacheKey: key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }
      }
      
      this.providers.clear();
      this.configCache.clear();
    }
    
    logger.info('[EmailProviderFactory] Cache cleared', { tenantId, configId });
  }
  
  // Private helper methods
  
  private static getCacheKey(tenantId: string, configId: string): string {
    return `${tenantId}-${configId}`;
  }
  
  private static validateConfig(config: ProviderConfig): void {
    if (!config.tenantId) {
      throw new EmailProviderError(
        'Tenant ID is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        'factory'
      );
    }
    
    if (!config.type) {
      throw new EmailProviderError(
        'Provider type is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        'factory'
      );
    }
    
    if (!config.name) {
      throw new EmailProviderError(
        'Provider name is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        'factory'
      );
    }
    
    if (!config.isActive) {
      throw new EmailProviderError(
        'Provider is not active',
        EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
        503,
        config.type
      );
    }
  }
  
  private static async isProviderHealthy(provider: EmailProvider): Promise<boolean> {
    try {
      const result = await provider.testConnection();
      return result.success;
    } catch (error) {
      return false;
    }
  }
  
  // Database integration methods (to be implemented)
  
  private static async getProviderConfig(
    tenantId: string, 
    providerName?: string
  ): Promise<ProviderConfig> {
    // TODO: Implement database lookup
    // If providerName is specified, find that specific config
    // Otherwise, find the default config for the tenant
    throw new EmailProviderError(
      'Database integration not implemented',
      EMAIL_ERROR_CODES.MISSING_CONFIG,
      500,
      'factory'
    );
  }
  
  private static async getProviderConfigForSender(
    senderIdentityId: string,
    tenantId: string
  ): Promise<ProviderConfig> {
    // TODO: Implement database lookup
    // Look up sender identity and get associated provider config
    // Fall back to tenant default if no specific config
    throw new EmailProviderError(
      'Database integration not implemented',
      EMAIL_ERROR_CODES.MISSING_CONFIG,
      500,
      'factory'
    );
  }
  
  private static async getAllProviderConfigs(tenantId: string): Promise<ProviderConfig[]> {
    // TODO: Implement database lookup
    // Get all active provider configs for tenant
    throw new EmailProviderError(
      'Database integration not implemented',
      EMAIL_ERROR_CODES.MISSING_CONFIG,
      500,
      'factory'
    );
  }
  
  /**
   * Gracefully shutdown all providers
   */
  static async shutdown(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];
    
    for (const [key, provider] of this.providers) {
      if (provider.cleanup) {
        cleanupPromises.push(
          provider.cleanup().catch((error) => {
            logger.warn('[EmailProviderFactory] Provider cleanup failed during shutdown', {
              cacheKey: key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          })
        );
      }
    }
    
    await Promise.allSettled(cleanupPromises);
    this.providers.clear();
    this.configCache.clear();
    
    logger.info('[EmailProviderFactory] Shutdown completed');
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await EmailProviderFactory.shutdown();
});

process.on('SIGINT', async () => {
  await EmailProviderFactory.shutdown();
});
```

## **Caching Strategy**

### **Cache Keys**
- Format: `{tenantId}-{configId}`
- Unique per tenant and configuration
- Support for cache invalidation

### **Cache Management**
- [ ] LRU eviction for memory management
- [ ] TTL for automatic cache expiration
- [ ] Health checking for cached providers
- [ ] Manual cache invalidation

## **Database Integration Points**

### **Required Repository Methods**
```typescript
// To be implemented with database tickets
interface ProviderConfigRepository {
  findDefaultForTenant(tenantId: string): Promise<ProviderConfig | undefined>;
  findByNameForTenant(name: string, tenantId: string): Promise<ProviderConfig | undefined>;
  findActiveForTenant(tenantId: string): Promise<ProviderConfig[]>;
  findForSenderIdentity(senderIdentityId: string, tenantId: string): Promise<ProviderConfig | undefined>;
}
```

## **Error Handling Strategy**

### **Provider Creation Errors**
- [ ] Invalid configuration handling
- [ ] Connection test failures
- [ ] Authentication failures
- [ ] Provider-specific errors

### **Fallback Strategy**
- [ ] Fallback to default provider on error
- [ ] Graceful degradation for non-critical failures
- [ ] Error reporting and monitoring

## **Testing Requirements**

### **Unit Tests**
- [ ] Test provider creation for all types
- [ ] Test caching functionality
- [ ] Test error handling scenarios
- [ ] Test cleanup and shutdown

### **Integration Tests**
- [ ] Test database integration (when implemented)
- [ ] Test provider health checking
- [ ] Test cache invalidation

### **Test Files**
```
server/src/libs/email/__tests__/EmailProviderFactory.test.ts
server/src/libs/email/__tests__/EmailProviderFactory.integration.test.ts
```

## **Performance Considerations**
- [ ] Efficient caching with minimal memory usage
- [ ] Async provider initialization
- [ ] Connection pooling where applicable
- [ ] Minimal database queries through caching

## **Security Considerations**
- [ ] Secure handling of provider credentials
- [ ] Cache isolation between tenants
- [ ] Audit logging for provider operations
- [ ] Rate limiting on provider creation

## **Monitoring and Observability**
- [ ] Metrics for provider creation and usage
- [ ] Health check endpoints
- [ ] Performance monitoring
- [ ] Error rate tracking

## **Documentation Requirements**
- [ ] Factory usage examples
- [ ] Caching strategy documentation
- [ ] Provider lifecycle documentation
- [ ] Troubleshooting guide

## **Definition of Done**
- [ ] Factory class implemented with all methods
- [ ] Caching functionality working correctly
- [ ] Error handling comprehensive
- [ ] Unit tests written and passing
- [ ] Performance benchmarks established
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Consider memory usage for high-volume tenants
- Plan for horizontal scaling (distributed cache)
- Ensure thread safety for concurrent access
- Consider provider warm-up strategies

## **Related Tickets**
- TICKET-005: Base Email Provider (prerequisite)
- TICKET-007: Database Schema for Provider Configs
- TICKET-008: Provider Config Repository
- TICKET-009: SendGrid Provider Implementation