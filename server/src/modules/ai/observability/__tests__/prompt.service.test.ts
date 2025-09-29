import { PromptService } from '../prompt.service';
import { LangFuseService, LangFuseConfig } from '../langfuse.service';

describe('PromptService', () => {
  let promptService: PromptService;
  let mockLangfuseService: jest.Mocked<LangFuseService>;

  beforeEach(() => {
    // Create mock LangFuse service
    const mockConfig: LangFuseConfig = {
      publicKey: 'test-pk',
      secretKey: 'test-sk',
      host: 'https://test.langfuse.com',
      enabled: false, // Disabled for testing
    };

    mockLangfuseService = {
      isAvailable: jest.fn().mockReturnValue(false),
      createTrace: jest.fn(),
      updateTrace: jest.fn(),
      logEvent: jest.fn(),
      logError: jest.fn(),
      createSpan: jest.fn(),
      updateSpan: jest.fn(),
      flush: jest.fn(),
      shutdown: jest.fn(),
      getConfig: jest.fn().mockReturnValue(mockConfig),
      getClient: jest.fn(),
    } as any;

    promptService = new PromptService(mockLangfuseService);
  });

  describe('variable injection', () => {
    it('should replace single variable correctly', () => {
      const template = 'Hello {{name}}!';
      const variables = { name: 'John' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple variables correctly', () => {
      const template = 'Hello {{name}}, you are {{age}} years old and live in {{city}}.';
      const variables = { name: 'Alice', age: '25', city: 'New York' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('Hello Alice, you are 25 years old and live in New York.');
    });

    it('should replace the same variable multiple times', () => {
      const template = '{{greeting}} {{name}}! How are you today, {{name}}?';
      const variables = { greeting: 'Hi', name: 'Bob' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('Hi Bob! How are you today, Bob?');
    });

    it('should throw error when variable not found', () => {
      const template = 'Hello {{name}}, you are {{age}} years old.';
      const variables = { name: 'Charlie' };
      expect(() => {
        promptService.injectVariables(template, variables);
      }).toThrow('Missing required variables for prompt injection: age');
    });

    it('should handle empty template', () => {
      const template = '';
      const variables = { name: 'Dave' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'This is a static template.';
      const variables = { name: 'Eve' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('This is a static template.');
    });

    it('should handle variables with special regex characters', () => {
      const template = 'Hello {{name}}!';
      const variables = { name: 'John [Smith]' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('Hello John [Smith]!');
    });
  });

  describe('prompt retrieval when LangFuse unavailable', () => {
    it('should throw error when LangFuse is not available', async () => {
      mockLangfuseService.isAvailable.mockReturnValue(false);

      await expect(promptService.getPrompt('summarize_site')).rejects.toThrow(
        'LangFuse is not available for prompt: summarize_site'
      );
    });
  });

  describe('LangFuse prompt retrieval', () => {
    beforeEach(() => {
      mockLangfuseService.isAvailable.mockReturnValue(true);
    });

    it('should fetch chat prompt from LangFuse', async () => {
      const mockClient = {
        prompt: {
          get: jest.fn().mockResolvedValue({
            id: 'prompt-123',
            type: 'chat',
            prompt: [
              { role: 'system', content: 'You are a helpful assistant analyzing {{domain}}' },
            ],
            version: 1,
            config: { model: 'gpt-4' },
            labels: ['production'],
          }),
        },
      };

      mockLangfuseService.getClient.mockReturnValue(mockClient);

      const result = await promptService.getPrompt('summarize_site');

      expect(result.prompt).toBe('You are a helpful assistant analyzing {{domain}}');
      expect(result.version).toBe('1');
      expect(result.metadata?.type).toBe('chat');
      expect(mockClient.prompt.get).toHaveBeenCalledWith('summarize_site');
    });

    it('should fetch text prompt from LangFuse', async () => {
      const mockClient = {
        prompt: {
          get: jest.fn().mockResolvedValue({
            id: 'prompt-456',
            type: 'text',
            prompt: 'Analyze the website {{domain}} and provide insights.',
            version: 2,
            config: { temperature: 0.7 },
            labels: ['production'],
          }),
        },
      };

      mockLangfuseService.getClient.mockReturnValue(mockClient);

      const result = await promptService.getPrompt('vendor_fit');

      expect(result.prompt).toBe('Analyze the website {{domain}} and provide insights.');
      expect(result.version).toBe('2');
      expect(result.metadata?.type).toBe('text');
    });

    it('should handle missing system message in chat prompt', async () => {
      const mockClient = {
        prompt: {
          get: jest.fn().mockResolvedValue({
            type: 'chat',
            prompt: [{ role: 'user', content: 'Hello' }],
          }),
        },
      };

      mockLangfuseService.getClient.mockReturnValue(mockClient);

      await expect(promptService.getPrompt('summarize_site')).rejects.toThrow(
        'No system message found in chat prompt'
      );
    });

    it('should handle unsupported prompt type', async () => {
      const mockClient = {
        prompt: {
          get: jest.fn().mockResolvedValue({
            type: 'unknown',
            prompt: 'some content',
          }),
        },
      };

      mockLangfuseService.getClient.mockReturnValue(mockClient);

      await expect(promptService.getPrompt('summarize_site')).rejects.toThrow(
        'Unsupported prompt type'
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}} and {{friend}}!';
      const variables = { name: 'Alice' };

      expect(() => {
        promptService.injectVariables(template, variables);
      }).toThrow('Missing required variables for prompt injection: friend');
    });

    it('should handle malformed variable syntax', () => {
      const template = 'Hello {name} and {{friend}}!';
      const variables = { name: 'Alice', friend: 'Bob' };
      const result = promptService.injectVariables(template, variables);
      expect(result).toBe('Hello {name} and Bob!'); // Only proper {{}} syntax is replaced
    });
  });
});
