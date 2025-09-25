import { 
  initializeObservability, 
  getObservabilityHealthStatus, 
  shutdownObservability,
  flushObservabilityData 
} from '../startup';
import { langfuseService } from '../langfuse.service';
import { promptService } from '../prompt.service';

// Mock the services
jest.mock('../langfuse.service', () => ({
  langfuseService: {
    waitForInitialization: jest.fn(),
    getHealthStatus: jest.fn(),
    shutdown: jest.fn(),
    flush: jest.fn(),
  },
}));

jest.mock('../prompt.service', () => ({
  promptService: {
    waitForInitialization: jest.fn(),
    getPrompt: jest.fn(),
    getCacheStats: jest.fn(),
    clearCache: jest.fn(),
  },
}));

describe('Observability Startup', () => {
  const mockLangfuseService = langfuseService as jest.Mocked<typeof langfuseService>;
  const mockPromptService = promptService as jest.Mocked<typeof promptService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mocks
    mockLangfuseService.waitForInitialization.mockResolvedValue(undefined);
    mockLangfuseService.getHealthStatus.mockReturnValue({
      isEnabled: true,
      isInitialized: true,
      isAvailable: true,
      client: true,
    });
    mockLangfuseService.shutdown.mockResolvedValue(undefined);
    mockLangfuseService.flush.mockResolvedValue(undefined);

    mockPromptService.waitForInitialization.mockResolvedValue(undefined);
    mockPromptService.getPrompt.mockResolvedValue({
      prompt: 'Test prompt',
      version: 1,
      metadata: {},
      cached: false,
    });
    mockPromptService.getCacheStats.mockReturnValue({
      size: 0,
      entries: [],
    });
  });

  describe('initializeObservability', () => {
    it('should initialize successfully with default options', async () => {
      const result = await initializeObservability();

      expect(result.success).toBe(true);
      expect(result.langfuse.available).toBe(true);
      expect(result.langfuse.healthy).toBe(true);
      expect(result.prompts.available).toBe(true);
      expect(result.errors).toHaveLength(0);

      expect(mockLangfuseService.waitForInitialization).toHaveBeenCalled();
      expect(mockPromptService.waitForInitialization).toHaveBeenCalled();
    });

    it('should handle LangFuse initialization failure', async () => {
      mockLangfuseService.getHealthStatus.mockReturnValue({
        isEnabled: false,
        isInitialized: true,
        isAvailable: false,
        client: false,
      });

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(false);
      expect(result.prompts.available).toBe(true);
      expect(result.errors).toContain('LangFuse service is not available');
    });

    it('should handle prompt service initialization failure', async () => {
      mockPromptService.waitForInitialization.mockRejectedValue(new Error('Prompt service failed'));

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.langfuse.available).toBe(true);
      expect(result.prompts.available).toBe(false);
      expect(result.errors).toContain('Prompt service initialization failed: Prompt service failed');
    });

    it('should validate required prompts when requested', async () => {
      const customPrompts = ['custom_prompt_1', 'custom_prompt_2'];
      
      const result = await initializeObservability({
        validatePrompts: true,
        requiredPrompts: customPrompts,
        environment: 'prod',
      });

      expect(result.success).toBe(true);
      expect(result.prompts.validated).toBe(true);
      expect(result.prompts.validatedCount).toBe(2);

      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('custom_prompt_1', { environment: 'prod' });
      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('custom_prompt_2', { environment: 'prod' });
    });

    it('should validate default prompts when no custom prompts provided', async () => {
      const result = await initializeObservability({
        validatePrompts: true,
      });

      expect(result.success).toBe(true);
      expect(result.prompts.validated).toBe(true);
      expect(result.prompts.validatedCount).toBe(4); // Default prompts count

      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('summarize_site', { environment: 'local' });
      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('vendor_fit', { environment: 'local' });
      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('extract_contacts', { environment: 'local' });
      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('contact_strategy', { environment: 'local' });
    });

    it('should handle prompt validation failures', async () => {
      mockPromptService.getPrompt
        .mockResolvedValueOnce({
          prompt: 'Valid prompt',
          version: 1,
          metadata: {},
          cached: false,
        })
        .mockRejectedValueOnce(new Error('Prompt not found'))
        .mockResolvedValueOnce({
          prompt: '',
          version: 1,
          metadata: {},
          cached: false,
        })
        .mockResolvedValueOnce({
          prompt: 'Another valid prompt',
          version: 1,
          metadata: {},
          cached: false,
        });

      const result = await initializeObservability({
        validatePrompts: true,
        requiredPrompts: ['valid_prompt', 'missing_prompt', 'empty_prompt', 'valid_prompt_2'],
      });

      expect(result.success).toBe(false);
      expect(result.prompts.validated).toBe(false);
      expect(result.prompts.validatedCount).toBe(2);
      expect(result.prompts.errors).toHaveLength(2);
      expect(result.prompts.errors).toContain("Failed to validate prompt 'missing_prompt': Prompt not found");
      expect(result.prompts.errors).toContain("Prompt 'empty_prompt' is empty");
    });

    it('should handle initialization exceptions gracefully', async () => {
      mockLangfuseService.waitForInitialization.mockRejectedValue(new Error('Unexpected error'));

      const result = await initializeObservability();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Observability initialization failed: Unexpected error');
    });

    it('should use local environment by default for prompt validation', async () => {
      await initializeObservability({ validatePrompts: true });

      expect(mockPromptService.getPrompt).toHaveBeenCalledWith(
        expect.any(String), 
        { environment: 'local' }
      );
    });

    it('should use production environment when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await initializeObservability({ validatePrompts: true });

      expect(mockPromptService.getPrompt).toHaveBeenCalledWith(
        expect.any(String), 
        { environment: 'prod' }
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getObservabilityHealthStatus', () => {
    it('should return comprehensive health status', () => {
      const mockCacheStats = {
        size: 5,
        entries: [
          { key: 'test_prompt_local', age: 1000, ttl: 300000, expired: false },
        ],
      };
      mockPromptService.getCacheStats.mockReturnValue(mockCacheStats);

      const health = getObservabilityHealthStatus();

      expect(health).toEqual({
        langfuse: {
          isEnabled: true,
          isInitialized: true,
          isAvailable: true,
          client: true,
        },
        prompts: {
          available: true,
          cacheStats: mockCacheStats,
        },
        overall: {
          healthy: true,
          lastCheck: expect.any(String),
        },
      });
    });

    it('should reflect unhealthy status when LangFuse is unavailable', () => {
      mockLangfuseService.getHealthStatus.mockReturnValue({
        isEnabled: false,
        isInitialized: true,
        isAvailable: false,
        client: false,
      });

      const health = getObservabilityHealthStatus();

      expect(health.overall.healthy).toBe(false);
      expect(health.langfuse.isAvailable).toBe(false);
    });
  });

  describe('shutdownObservability', () => {
    it('should shutdown successfully', async () => {
      await shutdownObservability();

      expect(mockPromptService.clearCache).toHaveBeenCalled();
      expect(mockLangfuseService.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockLangfuseService.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      await expect(shutdownObservability()).rejects.toThrow('Shutdown failed');
      expect(mockPromptService.clearCache).toHaveBeenCalled();
    });
  });

  describe('flushObservabilityData', () => {
    it('should flush successfully', async () => {
      await flushObservabilityData();

      expect(mockLangfuseService.flush).toHaveBeenCalled();
    });

    it('should handle flush errors', async () => {
      mockLangfuseService.flush.mockRejectedValue(new Error('Flush failed'));

      await expect(flushObservabilityData()).rejects.toThrow('Flush failed');
    });
  });
});