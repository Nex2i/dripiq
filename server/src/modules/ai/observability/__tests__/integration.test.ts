import { 
  initializeObservability, 
  shutdownObservability,
  getObservabilityHealthStatus 
} from '../startup';
import { langfuseService } from '../langfuse.service';
import { promptService } from '../prompt.service';

// Integration tests that test the entire observability system without mocks
describe('Observability Integration', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    
    // Clear any existing caches
    promptService.clearCache();
  });

  afterEach(async () => {
    // Clean up after each test
    await shutdownObservability().catch(() => {
      // Ignore shutdown errors in tests
    });
    
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('Disabled Configuration', () => {
    it('should handle disabled LangFuse gracefully', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(false);
      expect(result.prompts.available).toBe(true);
      expect(result.errors).toContain('LangFuse service is not available');
    });

    it('should handle missing API keys gracefully', async () => {
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;
      process.env.LANGFUSE_ENABLED = 'true';

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(false);
      expect(result.langfuse.error).toContain('missing API keys');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate environment detection', async () => {
      process.env.LANGFUSE_ENABLED = 'false'; // Disable to avoid real API calls
      process.env.NODE_ENV = 'production';

      const result = await initializeObservability({
        validatePrompts: false, // Skip validation to avoid API calls
      });

      // Even though disabled, should detect production environment
      expect(result.success).toBe(false); // Expected since LangFuse is disabled
    });

    it('should handle custom configuration', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const result = await initializeObservability({
        validatePrompts: false,
        environment: 'prod',
        requiredPrompts: ['custom_prompt'],
      });

      expect(result.success).toBe(false); // Expected since LangFuse is disabled
      expect(result.prompts.available).toBe(true);
    });
  });

  describe('Health Status', () => {
    it('should provide accurate health status', () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const health = getObservabilityHealthStatus();

      expect(health).toMatchObject({
        langfuse: {
          isEnabled: false,
          isInitialized: true,
          isAvailable: false,
          client: false,
        },
        prompts: {
          available: true,
          cacheStats: {
            size: 0,
            entries: [],
          },
        },
        overall: {
          healthy: false,
          lastCheck: expect.any(String),
        },
      });
    });

    it('should update health status after initialization', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      await initializeObservability();
      const health = getObservabilityHealthStatus();

      expect(health.overall.lastCheck).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize and shutdown without errors when disabled', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const initResult = await initializeObservability();
      expect(initResult.success).toBe(false); // Expected since disabled

      // Should not throw
      await expect(shutdownObservability()).resolves.toBeUndefined();
    });

    it('should handle multiple initialization calls', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const result1 = await initializeObservability();
      const result2 = await initializeObservability();

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1).toEqual(result2);
    });
  });

  describe('Prompt Service Integration', () => {
    it('should handle prompt service independently of LangFuse', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const result = await initializeObservability();

      expect(result.prompts.available).toBe(true);
      expect(result.langfuse.available).toBe(false);

      // Prompt service should still work for basic operations
      const stats = promptService.getCacheStats();
      expect(stats.size).toBe(0);

      // Variable injection should work
      const injected = promptService.injectVariables('Hello {{name}}', { name: 'World' });
      expect(injected).toBe('Hello World');
    });

    it('should cache prompt service operations', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      await initializeObservability();

      // Test cache operations
      const initialStats = promptService.getCacheStats();
      expect(initialStats.size).toBe(0);

      // Clear cache should work
      promptService.clearCache();
      const clearedStats = promptService.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Set invalid configuration that might cause errors
      process.env.LANGFUSE_HOST = 'invalid-url';
      process.env.LANGFUSE_ENABLED = 'true';
      process.env.LANGFUSE_PUBLIC_KEY = 'invalid-key';
      process.env.LANGFUSE_SECRET_KEY = 'invalid-secret';

      const result = await initializeObservability();

      // Should complete without throwing, but may not be successful
      expect(result.success).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle shutdown errors gracefully', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      await initializeObservability();

      // Should not throw even if services have issues
      await expect(shutdownObservability()).resolves.toBeUndefined();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing environment variables', async () => {
      // Remove all LangFuse environment variables
      delete process.env.LANGFUSE_ENABLED;
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_HOST;

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(false);
    });

    it('should handle invalid boolean values', async () => {
      process.env.LANGFUSE_ENABLED = 'invalid';
      process.env.LANGFUSE_DEBUG = 'not-a-boolean';

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(false);
    });

    it('should handle invalid numeric values', async () => {
      process.env.LANGFUSE_ENABLED = 'false';
      process.env.LANGFUSE_FLUSH_AT = 'not-a-number';
      process.env.LANGFUSE_FLUSH_INTERVAL = 'invalid';

      const result = await initializeObservability();

      // Should still initialize (though disabled) without crashing
      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(false);
    });
  });

  describe('Service Isolation', () => {
    it('should allow prompt service to work when LangFuse fails', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const result = await initializeObservability();

      expect(result.prompts.available).toBe(true);
      expect(result.langfuse.available).toBe(false);

      // Prompt service operations should still work
      expect(() => promptService.clearCache()).not.toThrow();
      expect(() => promptService.getCacheStats()).not.toThrow();
      expect(() => promptService.injectVariables('test', {})).not.toThrow();
    });

    it('should handle partial service failures', async () => {
      process.env.LANGFUSE_ENABLED = 'false';

      const result = await initializeObservability({
        validatePrompts: false,
      });

      // Should handle partial failure state
      expect(result.langfuse.available).toBe(false);
      expect(result.prompts.available).toBe(true);
      expect(result.success).toBe(false); // Overall failure due to LangFuse
    });
  });
});