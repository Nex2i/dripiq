import { LangFuseService } from '../langfuse.service';

// Mock langfuse
jest.mock('langfuse', () => {
  return {
    Langfuse: jest.fn().mockImplementation(() => ({
      trace: jest.fn().mockReturnValue({
        id: 'trace-123',
        generation: jest.fn().mockReturnValue({
          id: 'generation-123',
          update: jest.fn(),
          end: jest.fn(),
          score: jest.fn(),
        }),
        span: jest.fn().mockReturnValue({
          id: 'span-123',
          update: jest.fn(),
          end: jest.fn(),
        }),
        event: jest.fn().mockReturnValue({
          id: 'event-123',
          update: jest.fn(),
          end: jest.fn(),
        }),
        update: jest.fn(),
        end: jest.fn(),
        score: jest.fn(),
      }),
      flushAsync: jest.fn().mockResolvedValue(undefined),
      shutdownAsync: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('LangFuseService', () => {
  let service: LangFuseService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up test environment variables
    process.env.LANGFUSE_PUBLIC_KEY = 'test-public-key';
    process.env.LANGFUSE_SECRET_KEY = 'test-secret-key';
    process.env.LANGFUSE_HOST = 'https://test.langfuse.com';
    process.env.LANGFUSE_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_HOST;
    delete process.env.LANGFUSE_ENABLED;
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', () => {
      service = new LangFuseService();
      expect(service.isAvailable()).toBe(true);
    });

    it('should be disabled when LANGFUSE_ENABLED is false', () => {
      process.env.LANGFUSE_ENABLED = 'false';
      service = new LangFuseService();
      expect(service.isAvailable()).toBe(false);
    });

    it('should be disabled when API keys are missing', () => {
      delete process.env.LANGFUSE_PUBLIC_KEY;
      service = new LangFuseService();
      expect(service.isAvailable()).toBe(false);
    });

    it('should use custom configuration', () => {
      service = new LangFuseService({
        publicKey: 'custom-public',
        secretKey: 'custom-secret',
        baseUrl: 'https://custom.langfuse.com',
        enabled: true,
      });
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('trace operations', () => {
    beforeEach(() => {
      service = new LangFuseService();
    });

    it('should create a trace successfully', () => {
      const trace = service.createTrace('test-trace', {
        tenantId: 'tenant-123',
        userId: 'user-456',
        sessionId: 'session-789',
        metadata: { test: 'data' },
        tags: ['test'],
      });

      expect(trace).toBeDefined();
      expect(trace.id).toBe('trace-123');
    });

    it('should return null when service is not available', () => {
      process.env.LANGFUSE_ENABLED = 'false';
      const disabledService = new LangFuseService();
      
      const trace = disabledService.createTrace('test-trace');
      expect(trace).toBeNull();
    });

    it('should create generation within trace', () => {
      const trace = service.createTrace('test-trace');
      const generation = service.createGeneration(trace, {
        name: 'test-generation',
        model: 'gpt-4',
        input: { prompt: 'test' },
        output: { response: 'test response' },
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      expect(generation).toBeDefined();
      expect(generation.id).toBe('generation-123');
    });

    it('should create span within trace', () => {
      const trace = service.createTrace('test-trace');
      const span = service.createSpan(trace, {
        name: 'test-span',
        input: { data: 'test' },
        output: { result: 'success' },
        metadata: { type: 'test' },
      });

      expect(span).toBeDefined();
      expect(span.id).toBe('span-123');
    });

    it('should create event within trace', () => {
      const trace = service.createTrace('test-trace');
      const event = service.createEvent(trace, {
        name: 'test-event',
        input: { action: 'test' },
        output: { status: 'completed' },
        level: 'DEFAULT',
      });

      expect(event).toBeDefined();
      expect(event.id).toBe('event-123');
    });
  });

  describe('element operations', () => {
    beforeEach(() => {
      service = new LangFuseService();
    });

    it('should update element successfully', () => {
      const trace = service.createTrace('test-trace');
      const element = trace.generation({ name: 'test' });

      service.updateElement(element, {
        output: { updated: true },
        metadata: { version: 2 },
        level: 'DEFAULT',
      });

      expect(element.update).toHaveBeenCalledWith({
        output: { updated: true },
        metadata: { version: 2 },
        level: 'DEFAULT',
        endTime: undefined,
      });
    });

    it('should end element successfully', () => {
      const trace = service.createTrace('test-trace');
      const element = trace.generation({ name: 'test' });

      service.endElement(element, {
        output: { final: true },
        level: 'DEFAULT',
      });

      expect(element.end).toHaveBeenCalledWith({
        output: { final: true },
        metadata: undefined,
        level: 'DEFAULT',
      });
    });

    it('should score element successfully', () => {
      const trace = service.createTrace('test-trace');

      service.score(trace, 'accuracy', 0.95, 'High accuracy score');

      expect(trace.score).toHaveBeenCalledWith({
        name: 'accuracy',
        value: 0.95,
        comment: 'High accuracy score',
      });
    });
  });

  describe('lifecycle operations', () => {
    beforeEach(() => {
      service = new LangFuseService();
    });

    it('should flush events successfully', async () => {
      await service.flush();
      expect((service as any).client.flushAsync).toHaveBeenCalled();
    });

    it('should shutdown successfully', async () => {
      await service.shutdown();
      expect((service as any).client.shutdownAsync).toHaveBeenCalled();
    });

    it('should handle flush when service is not available', async () => {
      process.env.LANGFUSE_ENABLED = 'false';
      const disabledService = new LangFuseService();
      
      // Should not throw
      await expect(disabledService.flush()).resolves.toBeUndefined();
    });

    it('should handle shutdown when service is not available', async () => {
      process.env.LANGFUSE_ENABLED = 'false';
      const disabledService = new LangFuseService();
      
      // Should not throw
      await expect(disabledService.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('health status', () => {
    it('should return correct health status when enabled', () => {
      service = new LangFuseService();
      const health = service.getHealthStatus();

      expect(health).toEqual({
        isEnabled: true,
        isInitialized: true,
        isAvailable: true,
        client: true,
      });
    });

    it('should return correct health status when disabled', () => {
      process.env.LANGFUSE_ENABLED = 'false';
      service = new LangFuseService();
      const health = service.getHealthStatus();

      expect(health).toEqual({
        isEnabled: false,
        isInitialized: true,
        isAvailable: false,
        client: false,
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      service = new LangFuseService();
    });

    it('should handle element operations gracefully when element is null', () => {
      expect(() => service.updateElement(null, { output: {} })).not.toThrow();
      expect(() => service.endElement(null)).not.toThrow();
      expect(() => service.score(null, 'test', 1)).not.toThrow();
    });

    it('should handle trace creation errors gracefully', () => {
      const mockClient = (service as any).client;
      mockClient.trace.mockImplementation(() => {
        throw new Error('Trace creation failed');
      });

      const trace = service.createTrace('failing-trace');
      expect(trace).toBeNull();
    });
  });
});