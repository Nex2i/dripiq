import { PromptService } from '../prompt.service';
import { langfuseService } from '../langfuse.service';

// Mock the langfuse service
jest.mock('../langfuse.service', () => ({
  langfuseService: {
    waitForInitialization: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockReturnValue(true),
    client: {
      getPrompt: jest.fn(),
    },
  },
}));

describe('PromptService', () => {
  let service: PromptService;
  const mockLangfuseClient = (langfuseService as any).client;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromptService();
    
    // Mock successful LangFuse prompt fetch
    mockLangfuseClient.getPrompt.mockResolvedValue({
      prompt: 'Test prompt content with {{variable}}',
      version: 1,
      metadata: { created: '2024-01-01' },
    });
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.waitForInitialization();
      expect(langfuseService.waitForInitialization).toHaveBeenCalled();
    });
  });

  describe('prompt fetching', () => {
    it('should fetch prompt from LangFuse successfully', async () => {
      const result = await service.getPrompt('test_prompt');

      expect(result).toEqual({
        prompt: 'Test prompt content with {{variable}}',
        version: 1,
        metadata: expect.objectContaining({
          created: '2024-01-01',
          environment: 'local',
          promptName: 'test_prompt',
        }),
        cached: false,
      });

      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'local',
      });
    });

    it('should use prod environment when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await service.getPrompt('test_prompt');

      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'prod',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should use custom environment when specified', async () => {
      await service.getPrompt('test_prompt', { environment: 'prod' });

      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'prod',
      });
    });

    it('should cache prompt results', async () => {
      // First call
      const result1 = await service.getPrompt('test_prompt');
      expect(result1.cached).toBe(false);

      // Second call should be cached
      const result2 = await service.getPrompt('test_prompt');
      expect(result2.cached).toBe(true);
      expect(result2.prompt).toBe(result1.prompt);

      // LangFuse should only be called once
      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledTimes(1);
    });

    it('should respect custom cache TTL', async () => {
      const result = await service.getPrompt('test_prompt', { cacheTtlSeconds: 1 });
      expect(result.cached).toBe(false);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result2 = await service.getPrompt('test_prompt', { cacheTtlSeconds: 1 });
      expect(result2.cached).toBe(false);

      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledTimes(2);
    });

    it('should use stale cache as fallback when LangFuse fails', async () => {
      // First successful call
      await service.getPrompt('test_prompt');

      // Make LangFuse fail
      mockLangfuseClient.getPrompt.mockRejectedValue(new Error('Network error'));

      const result = await service.getPrompt('test_prompt');
      expect(result.cached).toBe(true);
      expect(result.metadata?.fallbackUsed).toBe(true);
      expect(result.metadata?.originalError).toBe('Network error');
    });

    it('should throw error when prompt not found and no cache available', async () => {
      mockLangfuseClient.getPrompt.mockRejectedValue(new Error('Prompt not found'));

      await expect(service.getPrompt('nonexistent_prompt')).rejects.toThrow(
        "Failed to retrieve prompt 'nonexistent_prompt' for environment 'local': Prompt not found"
      );
    });

    it('should handle LangFuse service not available', async () => {
      (langfuseService.isAvailable as jest.Mock).mockReturnValue(false);

      await expect(service.getPrompt('test_prompt')).rejects.toThrow(
        'LangFuse service is not available'
      );
    });
  });

  describe('variable injection', () => {
    it('should inject variables correctly', () => {
      const template = 'Hello {{name}}, your role is {{role}}.';
      const variables = { name: 'John', role: 'developer' };

      const result = service.injectVariables(template, variables);
      expect(result).toBe('Hello John, your role is developer.');
    });

    it('should handle object variables by stringifying them', () => {
      const template = 'Data: {{data}}';
      const variables = { data: { key: 'value', nested: { prop: 'test' } } };

      const result = service.injectVariables(template, variables);
      expect(result).toContain('"key": "value"');
      expect(result).toContain('"nested"');
    });

    it('should leave missing variables as placeholders', () => {
      const template = 'Hello {{name}}, your {{missing}} is undefined.';
      const variables = { name: 'John' };

      const result = service.injectVariables(template, variables);
      expect(result).toBe('Hello John, your {{missing}} is undefined.');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {{name}}';
      const result = service.injectVariables(template, {});
      expect(result).toBe('Hello {{name}}');
    });

    it('should handle template with no variables', () => {
      const template = 'Hello world';
      const variables = { name: 'John' };

      const result = service.injectVariables(template, variables);
      expect(result).toBe('Hello world');
    });

    it('should handle whitespace in variable names', () => {
      const template = 'Hello {{ name }}, your {{  role  }} is important.';
      const variables = { name: 'John', role: 'developer' };

      const result = service.injectVariables(template, variables);
      expect(result).toBe('Hello John, your developer is important.');
    });
  });

  describe('getPromptWithVariables', () => {
    it('should fetch prompt and inject variables', async () => {
      const variables = { variable: 'test_value' };
      
      const result = await service.getPromptWithVariables('test_prompt', variables);

      expect(result.prompt).toBe('Test prompt content with test_value');
      expect(result.metadata?.variablesInjected).toEqual(['variable']);
      expect(result.metadata?.injectedVariableCount).toBe(1);
    });

    it('should work with custom options', async () => {
      const variables = { variable: 'test_value' };
      
      await service.getPromptWithVariables('test_prompt', variables, { 
        environment: 'prod',
        cacheTtlSeconds: 60 
      });

      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'prod',
      });
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      // Populate cache
      await service.getPrompt('prompt1');
      await service.getPrompt('prompt2', { environment: 'prod' });
    });

    it('should clear specific prompt from cache', () => {
      service.clearCache('prompt1', 'local');
      
      const stats = service.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].key).toBe('prompt2_prod');
    });

    it('should clear all environments for a prompt', () => {
      service.clearCache('prompt1');
      
      const stats = service.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].key).toBe('prompt2_prod');
    });

    it('should clear entire cache', () => {
      service.clearCache();
      
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toMatchObject({
        key: expect.stringMatching(/prompt[12]_(local|prod)/),
        age: expect.any(Number),
        ttl: expect.any(Number),
        expired: expect.any(Boolean),
      });
    });

    it('should mark expired entries correctly', async () => {
      // Clear and add with short TTL
      service.clearCache();
      await service.getPrompt('test_prompt', { cacheTtlSeconds: 0.001 });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = service.getCacheStats();
      expect(stats.entries[0].expired).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle variable injection with null variables', () => {
      const template = 'Hello {{name}}';
      const result = service.injectVariables(template, null as any);
      expect(result).toBe('Hello {{name}}');
    });

    it('should handle LangFuse client errors gracefully', async () => {
      mockLangfuseClient.getPrompt.mockRejectedValue(new Error('Connection timeout'));

      await expect(service.getPrompt('test_prompt')).rejects.toThrow(
        "Failed to retrieve prompt 'test_prompt' for environment 'local': Connection timeout"
      );
    });

    it('should handle prompt fetch returning null', async () => {
      mockLangfuseClient.getPrompt.mockResolvedValue(null);

      await expect(service.getPrompt('test_prompt')).rejects.toThrow(
        "Prompt 'test_prompt' not found in environment 'local'"
      );
    });
  });

  describe('environment detection', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect local environment by default', async () => {
      delete process.env.NODE_ENV;
      await service.getPrompt('test_prompt');
      
      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'local',
      });
    });

    it('should detect production environment', async () => {
      process.env.NODE_ENV = 'production';
      await service.getPrompt('test_prompt');
      
      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'prod',
      });
    });

    it('should detect prod environment from NODE_ENV=prod', async () => {
      process.env.NODE_ENV = 'prod';
      await service.getPrompt('test_prompt');
      
      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'prod',
      });
    });

    it('should treat development as local', async () => {
      process.env.NODE_ENV = 'development';
      await service.getPrompt('test_prompt');
      
      expect(mockLangfuseClient.getPrompt).toHaveBeenCalledWith('test_prompt', {
        environment: 'local',
      });
    });
  });
});