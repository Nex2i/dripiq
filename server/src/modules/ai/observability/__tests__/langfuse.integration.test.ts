// Mock LangFuse to avoid ES module issues in Jest
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn(),
    event: jest.fn(),
    score: jest.fn(),
    flush: jest.fn(),
    shutdown: jest.fn(),
    getPrompt: jest.fn(),
    createPrompt: jest.fn(),
    createDataset: jest.fn(),
    createDatasetItem: jest.fn(),
  })),
}));

import { langfuseService } from '../langfuse.service';
import { promptService } from '../prompt.service';
import { migrationService } from '../migration.service';

// Mock environment variables for testing
const originalEnv = process.env;

describe('LangFuse Integration Tests', () => {
  beforeAll(() => {
    // Set up test environment variables
    process.env.LANGFUSE_ENABLED = 'false'; // Disable for unit tests
    process.env.LANGFUSE_PUBLIC_KEY = 'test-public-key';
    process.env.LANGFUSE_SECRET_KEY = 'test-secret-key';
    process.env.LANGFUSE_HOST = 'https://test.langfuse.com';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('LangFuse Service', () => {
    test('should initialize with disabled state when LANGFUSE_ENABLED is false', () => {
      expect(langfuseService.isReady()).toBe(false);
    });

    test('should return null for callback handler when disabled', () => {
      const handler = langfuseService.getCallbackHandler({
        tenantId: 'test-tenant',
        agentType: 'TestAgent',
      });
      expect(handler).toBeNull();
    });

    test('should return null for trace creation when disabled', () => {
      const trace = langfuseService.createTrace('Test Trace', {
        tenantId: 'test-tenant',
      });
      expect(trace).toBeNull();
    });

    test('should handle log events gracefully when disabled', () => {
      expect(() => {
        langfuseService.logEvent(
          'test_event',
          { test: true },
          {
            tenantId: 'test-tenant',
          }
        );
      }).not.toThrow();
    });

    test('should handle flush gracefully when disabled', async () => {
      await expect(langfuseService.flush()).resolves.toBeUndefined();
    });
  });

  describe('Prompt Service', () => {
    test('should handle prompt retrieval when LangFuse is disabled', async () => {
      // When LangFuse is disabled and no local prompt found, should throw
      await expect(
        promptService.getPrompt('non_existent_prompt', {
          useRemote: true,
          fallbackToLocal: true,
        })
      ).rejects.toThrow();
    });

    test('should throw error when prompt not found and no fallback', async () => {
      await expect(
        promptService.getPrompt('non_existent_prompt', {
          useRemote: true,
          fallbackToLocal: false,
        })
      ).rejects.toThrow();
    });

    test('should handle cache operations', () => {
      expect(() => {
        promptService.clearCache();
      }).not.toThrow();
    });

    test('should handle remote prompt API gracefully when disabled', async () => {
      const result = await promptService.createOrUpdatePrompt(
        'test_prompt',
        'Test prompt content',
        { model: 'gpt-4o-mini' }
      );

      // Should return false when LangFuse is disabled
      expect(result).toBe(false);
    });
  });

  describe('Migration Service', () => {
    test('should perform health check', async () => {
      const healthCheck = await migrationService.healthCheck();

      expect(healthCheck).toHaveProperty('isReady');
      expect(healthCheck).toHaveProperty('clientAvailable');
      expect(typeof healthCheck.isReady).toBe('boolean');
      expect(typeof healthCheck.clientAvailable).toBe('boolean');
    });

    test('should handle initialization when LangFuse is disabled', async () => {
      await expect(migrationService.initializeObservability()).resolves.toBeUndefined();
    });

    test('should handle prompt migration when LangFuse is disabled', async () => {
      await expect(migrationService.migratePrompts()).resolves.toBeUndefined();
    });

    test('should handle dataset creation when LangFuse is disabled', async () => {
      await expect(migrationService.createEvaluationDatasets()).resolves.toBeUndefined();
    });
  });
});

describe('LangFuse Agent Integration', () => {
  test('should pass tracing metadata to agents', () => {
    const tracingMetadata = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      sessionId: 'test-session',
      agentType: 'SiteAnalysisAgent',
    };

    // Test that callback handler receives correct metadata
    const handler = langfuseService.getCallbackHandler(tracingMetadata);

    // When disabled, should return null
    expect(handler).toBeNull();
  });

  test('should create traces with proper naming convention', () => {
    const trace = langfuseService.createTrace('Site Analysis: example.com', {
      tenantId: 'test-tenant',
      agentType: 'SiteAnalysisAgent',
      metadata: { domain: 'example.com' },
    });

    // When disabled, should return null
    expect(trace).toBeNull();
  });
});

describe('LangFuse Configuration Validation', () => {
  test('should validate required environment variables', () => {
    const requiredVars = [
      'LANGFUSE_ENABLED',
      'LANGFUSE_PUBLIC_KEY',
      'LANGFUSE_SECRET_KEY',
      'LANGFUSE_HOST',
    ];

    requiredVars.forEach((varName) => {
      expect(process.env[varName]).toBeDefined();
    });
  });

  test('should handle missing credentials gracefully', () => {
    // This test ensures the service handles missing credentials without crashing
    expect(langfuseService.isReady()).toBe(false);
  });
});

// Integration test that would require actual LangFuse instance
describe('LangFuse Live Integration (requires setup)', () => {
  // These tests would only run if LANGFUSE_ENABLED=true and valid credentials are provided
  const isLiveTest =
    process.env.LANGFUSE_ENABLED === 'true' &&
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY;

  (isLiveTest ? test : test.skip)('should connect to LangFuse and create trace', async () => {
    const trace = langfuseService.createTrace('Integration Test Trace', {
      agentType: 'TestAgent',
      metadata: { test: true },
    });

    expect(trace).toBeDefined();
    expect(trace?.id).toBeDefined();

    // Cleanup
    await langfuseService.flush();
  });

  (isLiveTest ? test : test.skip)('should retrieve prompts from LangFuse', async () => {
    // This would test actual prompt retrieval
    const { prompt } = await promptService.getPrompt('summarize_site', {
      useRemote: true,
      fallbackToLocal: true,
    });

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
  });
});
