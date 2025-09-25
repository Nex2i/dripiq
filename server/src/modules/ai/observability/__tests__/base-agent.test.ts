import { BaseObservableAgent } from '../base-agent';
import { langfuseService } from '../langfuse.service';
import { promptService } from '../prompt.service';
import { 
  AgentExecutionOptions,
  PromptInjectionContext,
  AgentTracingContext,
  AgentError,
  AgentErrorType 
} from '../types';

// Mock the services
jest.mock('../langfuse.service', () => ({
  langfuseService: {
    isAvailable: jest.fn().mockReturnValue(true),
    createTrace: jest.fn(),
    createSpan: jest.fn(),
    createGeneration: jest.fn(),
    createEvent: jest.fn(),
    updateElement: jest.fn(),
    endElement: jest.fn(),
    score: jest.fn(),
  },
}));

jest.mock('../prompt.service', () => ({
  promptService: {
    getPrompt: jest.fn(),
    injectVariables: jest.fn(),
  },
}));

// Test implementation of BaseObservableAgent
class TestAgent extends BaseObservableAgent<{ input: string }, { output: string }> {
  protected getAgentName(): string {
    return 'TestAgent';
  }

  protected getAgentVersion(): string {
    return '1.0.0';
  }

  protected getPromptName(): string {
    return 'test_prompt';
  }

  protected getAgentDescription(): string {
    return 'Test agent for unit testing';
  }

  protected preparePromptContext(input: { input: string }): PromptInjectionContext {
    return {
      variables: {
        inputData: input.input,
      },
    };
  }

  protected async executeCore(
    input: { input: string },
    promptContent: string,
    context: AgentTracingContext
  ): Promise<{
    finalResponse: string;
    finalResponseParsed: { output: string };
    totalIterations: number;
    functionCalls: any[];
  }> {
    if (input.input === 'error') {
      throw new Error('Test error');
    }

    return {
      finalResponse: `Processed: ${input.input}`,
      finalResponseParsed: { output: `Result: ${input.input}` },
      totalIterations: 1,
      functionCalls: [],
    };
  }
}

describe('BaseObservableAgent', () => {
  let agent: TestAgent;
  const mockLangfuseService = langfuseService as jest.Mocked<typeof langfuseService>;
  const mockPromptService = promptService as jest.Mocked<typeof promptService>;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TestAgent();

    // Default mocks
    mockLangfuseService.isAvailable.mockReturnValue(true);
    mockLangfuseService.createTrace.mockReturnValue({
      id: 'trace-123',
      generation: jest.fn(),
      span: jest.fn(),
      event: jest.fn(),
    });
    mockLangfuseService.createSpan.mockReturnValue({
      id: 'span-123',
      update: jest.fn(),
      end: jest.fn(),
    });

    mockPromptService.getPrompt.mockResolvedValue({
      prompt: 'Test prompt with {{inputData}}',
      version: 1,
      metadata: {},
      cached: false,
    });
    mockPromptService.injectVariables.mockReturnValue('Test prompt with test input');
  });

  describe('agent metadata', () => {
    it('should return correct agent metadata', () => {
      const metadata = agent.getAgentMetadata();
      
      expect(metadata).toEqual({
        name: 'TestAgent',
        version: '1.0.0',
        promptName: 'test_prompt',
        description: 'Test agent for unit testing',
      });
    });
  });

  describe('execute method', () => {
    it('should execute successfully with tracing enabled', async () => {
      const options: AgentExecutionOptions = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        sessionId: 'session-789',
        enableTracing: true,
        metadata: { source: 'test' },
        tags: ['test-tag'],
      };

      const result = await agent.execute({ input: 'test input' }, options);

      expect(result).toEqual({
        finalResponse: 'Processed: test input',
        finalResponseParsed: { output: 'Result: test input' },
        totalIterations: 1,
        functionCalls: [],
        traceId: 'trace-123',
        executionMetadata: {
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          duration: expect.any(Number),
          model: undefined,
          tokenUsage: undefined,
        },
      });
    });

    it('should execute successfully without tracing', async () => {
      mockLangfuseService.isAvailable.mockReturnValue(false);

      const result = await agent.execute({ input: 'test input' }, { enableTracing: false });

      expect(result.traceId).toBeUndefined();
      expect(result.finalResponse).toBe('Processed: test input');
      expect(mockLangfuseService.createTrace).not.toHaveBeenCalled();
    });

    it('should create trace with correct options', async () => {
      const options: AgentExecutionOptions = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        sessionId: 'session-789',
        traceName: 'custom-trace',
        metadata: { source: 'test' },
        tags: ['test-tag'],
      };

      await agent.execute({ input: 'test input' }, options);

      expect(mockLangfuseService.createTrace).toHaveBeenCalledWith('custom-trace', {
        tenantId: 'tenant-123',
        userId: 'user-456',
        sessionId: 'session-789',
        metadata: {
          agent: 'TestAgent',
          agentVersion: '1.0.0',
          promptName: 'test_prompt',
          description: 'Test agent for unit testing',
          source: 'test',
        },
        tags: ['ai-agent', 'testagent', 'test-tag'],
      });
    });

    it('should use default trace name when not provided', async () => {
      await agent.execute({ input: 'test input' }, { enableTracing: true });

      expect(mockLangfuseService.createTrace).toHaveBeenCalledWith('TestAgent_execution', expect.any(Object));
    });

    it('should fetch and prepare prompt correctly', async () => {
      await agent.execute({ input: 'test input' });

      expect(mockPromptService.getPrompt).toHaveBeenCalledWith('test_prompt');
      expect(mockPromptService.injectVariables).toHaveBeenCalledWith(
        'Test prompt with {{inputData}}',
        { inputData: 'test input' }
      );
    });

    it('should handle prompt fetching errors', async () => {
      mockPromptService.getPrompt.mockRejectedValue(new Error('Prompt not found'));

      await expect(agent.execute({ input: 'test input' })).rejects.toThrow(AgentError);
      
      const error = await agent.execute({ input: 'test input' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.PROMPT_FETCH_ERROR);
      expect(error.message).toContain('Failed to fetch and prepare prompt');
    });

    it('should handle core execution errors', async () => {
      await expect(agent.execute({ input: 'error' })).rejects.toThrow(AgentError);
      
      const error = await agent.execute({ input: 'error' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.UNKNOWN_ERROR);
      expect(error.message).toBe('Test error');
    });

    it('should create execution span when tracing is enabled', async () => {
      await agent.execute({ input: 'test input' }, { enableTracing: true });

      expect(mockLangfuseService.createSpan).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'trace-123' }),
        {
          name: 'TestAgent_execution',
          metadata: {
            agentName: 'TestAgent',
            agentVersion: '1.0.0',
          },
        }
      );
    });

    it('should create prompt preparation span', async () => {
      await agent.execute({ input: 'test input' }, { enableTracing: true });

      expect(mockLangfuseService.createSpan).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'trace-123' }),
        {
          name: 'prompt_preparation',
          metadata: {
            promptName: 'test_prompt',
          },
        }
      );
    });

    it('should update and end spans appropriately', async () => {
      await agent.execute({ input: 'test input' }, { enableTracing: true });

      expect(mockLangfuseService.updateElement).toHaveBeenCalled();
      expect(mockLangfuseService.endElement).toHaveBeenCalled();
    });

    it('should score successful executions', async () => {
      await agent.execute({ input: 'test input' }, { enableTracing: true });

      expect(mockLangfuseService.score).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'trace-123' }),
        'execution_success',
        1,
        'Agent execution completed successfully'
      );
    });

    it('should score failed executions', async () => {
      try {
        await agent.execute({ input: 'error' }, { enableTracing: true });
      } catch (error) {
        // Expected to throw
      }

      expect(mockLangfuseService.score).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'trace-123' }),
        'execution_success',
        0,
        expect.stringContaining('Agent execution failed')
      );
    });

    it('should handle tracing errors gracefully', async () => {
      mockLangfuseService.createTrace.mockImplementation(() => {
        throw new Error('Tracing failed');
      });

      await expect(agent.execute({ input: 'test input' })).rejects.toThrow(AgentError);
      
      const error = await agent.execute({ input: 'test input' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.UNKNOWN_ERROR);
      expect(error.message).toBe('Failed to create LangFuse trace');
    });
  });

  describe('error handling', () => {
    it('should categorize prompt errors correctly', async () => {
      mockPromptService.getPrompt.mockRejectedValue(new Error('prompt not found'));

      const error = await agent.execute({ input: 'test' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.PROMPT_FETCH_ERROR);
    });

    it('should categorize parsing errors correctly', async () => {
      // Mock core execution to throw parsing error
      const mockAgent = new (class extends TestAgent {
        protected async executeCore(): Promise<any> {
          throw new Error('JSON parsing failed');
        }
      })();

      const error = await mockAgent.execute({ input: 'test' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.OUTPUT_PARSING_ERROR);
    });

    it('should categorize timeout errors correctly', async () => {
      const mockAgent = new (class extends TestAgent {
        protected async executeCore(): Promise<any> {
          throw new Error('Request timeout exceeded');
        }
      })();

      const error = await mockAgent.execute({ input: 'test' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.TIMEOUT_ERROR);
    });

    it('should categorize validation errors correctly', async () => {
      const mockAgent = new (class extends TestAgent {
        protected async executeCore(): Promise<any> {
          throw new Error('validation failed for input');
        }
      })();

      const error = await mockAgent.execute({ input: 'test' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.VALIDATION_ERROR);
    });

    it('should preserve existing AgentError instances', async () => {
      const originalError = new AgentError(
        AgentErrorType.LLM_EXECUTION_ERROR,
        'Custom error',
        { custom: 'context' },
        'trace-456'
      );

      const mockAgent = new (class extends TestAgent {
        protected async executeCore(): Promise<any> {
          throw originalError;
        }
      })();

      const error = await mockAgent.execute({ input: 'test' }).catch(err => err);
      expect(error).toBe(originalError);
      expect(error.type).toBe(AgentErrorType.LLM_EXECUTION_ERROR);
      expect(error.context.custom).toBe('context');
      expect(error.traceId).toBe('trace-456');
    });

    it('should include trace ID in errors when available', async () => {
      const error = await agent.execute({ input: 'error' }, { enableTracing: true }).catch(err => err);
      expect(error.traceId).toBe('trace-123');
    });

    it('should handle non-Error exceptions', async () => {
      const mockAgent = new (class extends TestAgent {
        protected async executeCore(): Promise<any> {
          throw 'String error';
        }
      })();

      const error = await mockAgent.execute({ input: 'test' }).catch(err => err);
      expect(error.type).toBe(AgentErrorType.UNKNOWN_ERROR);
      expect(error.message).toBe('Unknown error occurred');
    });
  });

  describe('execution metadata', () => {
    it('should include accurate timing information', async () => {
      const startTime = Date.now();
      const result = await agent.execute({ input: 'test input' });
      const endTime = Date.now();

      expect(result.executionMetadata).toBeDefined();
      expect(result.executionMetadata!.startTime.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(result.executionMetadata!.endTime.getTime()).toBeLessThanOrEqual(endTime);
      expect(result.executionMetadata!.duration).toBeGreaterThan(0);
      expect(result.executionMetadata!.duration).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });

    it('should include metrics when provided by core execution', async () => {
      const mockAgent = new (class extends TestAgent {
        protected async executeCore(): Promise<any> {
          return {
            finalResponse: 'test',
            finalResponseParsed: { output: 'test' },
            totalIterations: 1,
            functionCalls: [],
            metrics: {
              tokenUsage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
              },
            },
          };
        }
      })();

      const result = await mockAgent.execute({ input: 'test' });
      expect(result.executionMetadata!.tokenUsage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });
  });
});