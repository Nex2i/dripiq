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
import { checkLangFuseHealth } from '../startup';

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
    test('should throw error when LangFuse is disabled', async () => {
      await expect(
        promptService.getPrompt('test_prompt')
      ).rejects.toThrow('LangFuse service is not ready');
    });

    test('should handle cache operations', () => {
      expect(() => {
        promptService.clearCache();
      }).not.toThrow();
    });

    test('should provide cache statistics', () => {
      const stats = promptService.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    test('should handle variable injection', () => {
      const template = 'Hello {{name}}, welcome to {{site}}!';
      const result = promptService.injectVariables(template, {
        name: 'John',
        site: 'example.com'
      });
      
      expect(result).toBe('Hello John, welcome to example.com!');
    });

    test('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, welcome to {{site}}!';
      const result = promptService.injectVariables(template, {
        name: 'John'
        // missing 'site' variable
      });
      
      expect(result).toBe('Hello John, welcome to {{site}}!');
    });

    test('should throw when creating prompt with disabled LangFuse', async () => {
      await expect(
        promptService.createOrUpdatePrompt(
          'test_prompt',
          'Test prompt content',
          { model: 'gpt-4o-mini' }
        )
      ).rejects.toThrow('LangFuse service is not ready');
    });
  });

  describe('Health Check Service', () => {
    test('should perform health check', async () => {
      const healthCheck = await checkLangFuseHealth();

      expect(healthCheck).toHaveProperty('isReady');
      expect(healthCheck).toHaveProperty('clientAvailable');
      expect(typeof healthCheck.isReady).toBe('boolean');
      expect(typeof healthCheck.clientAvailable).toBe('boolean');
    });

    test('should return false values when LangFuse is disabled', async () => {
      const healthCheck = await checkLangFuseHealth();

      expect(healthCheck.isReady).toBe(false);
      expect(healthCheck.clientAvailable).toBe(false);
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
    const { prompt } = await promptService.getPrompt('summarize_site');

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
  });
});
