import { logger } from '@/libs/logger';
import { langfuseService } from './langfuse.service';
import { promptService } from './prompt.service';
import { 
  AgentExecutionOptions, 
  AgentExecutionResult, 
  AgentMetrics, 
  AgentTracingContext, 
  AgentError, 
  AgentErrorType,
  PromptInjectionContext 
} from './types';

/**
 * Base class for observable agents with LangFuse integration
 */
export abstract class BaseObservableAgent<TInput = any, TOutput = any> {
  protected abstract getAgentName(): string;
  protected abstract getAgentVersion(): string;
  protected abstract getPromptName(): string;
  protected abstract getAgentDescription(): string;

  /**
   * Execute the core agent logic - to be implemented by subclasses
   */
  protected abstract executeCore(
    input: TInput,
    promptContent: string,
    context: AgentTracingContext
  ): Promise<{
    finalResponse: string;
    finalResponseParsed: TOutput;
    totalIterations: number;
    functionCalls: any[];
    metrics?: Partial<AgentMetrics>;
  }>;

  /**
   * Prepare prompt injection context - to be implemented by subclasses
   */
  protected abstract preparePromptContext(input: TInput): PromptInjectionContext;

  /**
   * Execute the agent with full observability support
   */
  public async execute(
    input: TInput,
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult<TOutput>> {
    const startTime = new Date();
    const agentMetadata = this.getAgentMetadata();
    let tracingContext: AgentTracingContext | null = null;

    try {
      // Initialize tracing if enabled
      if (options.enableTracing !== false && langfuseService.isAvailable()) {
        tracingContext = await this.initializeTracing(agentMetadata, options);
      }

      // Fetch and prepare prompt
      const promptContent = await this.fetchAndPreparePrompt(input, tracingContext);

      // Execute core agent logic
      const result = await this.executeCore(input, promptContent, tracingContext!);

      // Calculate execution metrics
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const executionMetadata = {
        startTime,
        endTime,
        duration,
        model: result.metrics?.tokenUsage ? 'detected' : undefined,
        tokenUsage: result.metrics?.tokenUsage,
      };

      // Update tracing with success
      if (tracingContext) {
        await this.finalizeSucessfulTracing(tracingContext, result, executionMetadata);
      }

      logger.info('Agent execution completed successfully', {
        agent: agentMetadata.name,
        duration,
        iterations: result.totalIterations,
        functionCalls: result.functionCalls.length,
        traceId: tracingContext?.trace?.id,
        tenantId: options.tenantId,
        userId: options.userId,
      });

      return {
        ...result,
        traceId: tracingContext?.trace?.id,
        executionMetadata,
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Handle and trace errors
      const agentError = this.handleExecutionError(error, tracingContext);
      
      if (tracingContext) {
        await this.finalizeErrorTracing(tracingContext, agentError, duration);
      }

      logger.error('Agent execution failed', {
        agent: agentMetadata.name,
        duration,
        error: agentError.toJSON(),
        traceId: tracingContext?.trace?.id,
        tenantId: options.tenantId,
        userId: options.userId,
      });

      throw agentError;
    }
  }

  /**
   * Get agent metadata
   */
  public getAgentMetadata() {
    return {
      name: this.getAgentName(),
      version: this.getAgentVersion(),
      promptName: this.getPromptName(),
      description: this.getAgentDescription(),
    };
  }

  /**
   * Initialize LangFuse tracing
   */
  private async initializeTracing(
    agentMetadata: ReturnType<typeof this.getAgentMetadata>,
    options: AgentExecutionOptions
  ): Promise<AgentTracingContext> {
    const traceName = options.traceName || `${agentMetadata.name}_execution`;

    const trace = langfuseService.createTrace(traceName, {
      tenantId: options.tenantId,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: {
        agent: agentMetadata.name,
        agentVersion: agentMetadata.version,
        promptName: agentMetadata.promptName,
        description: agentMetadata.description,
        ...options.metadata,
      },
      tags: [
        'ai-agent',
        agentMetadata.name.toLowerCase(),
        ...(options.tags || []),
      ],
    });

    if (!trace) {
      throw new AgentError(
        AgentErrorType.UNKNOWN_ERROR,
        'Failed to create LangFuse trace',
        { agentName: agentMetadata.name }
      );
    }

    // Create execution span
    const executionSpan = langfuseService.createSpan(trace, {
      name: `${agentMetadata.name}_execution`,
      metadata: {
        agentName: agentMetadata.name,
        agentVersion: agentMetadata.version,
      },
    });

    const tracingContext: AgentTracingContext = {
      trace,
      executionSpan,
      options,
      agentMetadata,
    };

    logger.debug('Agent tracing initialized', {
      agent: agentMetadata.name,
      traceId: trace.id,
      tenantId: options.tenantId,
      userId: options.userId,
    });

    return tracingContext;
  }

  /**
   * Fetch and prepare prompt with tracing
   */
  private async fetchAndPreparePrompt(
    input: TInput,
    tracingContext: AgentTracingContext | null
  ): Promise<string> {
    const promptSpan = tracingContext ? langfuseService.createSpan(tracingContext.trace, {
      name: 'prompt_preparation',
      metadata: {
        promptName: this.getPromptName(),
      },
    }) : null;

    try {
      // Get prompt injection context from subclass
      const promptContext = this.preparePromptContext(input);

      // Fetch prompt from LangFuse
      const promptResult = await promptService.getPrompt(this.getPromptName());

      // Inject variables if provided
      const finalPrompt = promptContext.variables 
        ? promptService.injectVariables(promptResult.prompt, promptContext.variables)
        : promptResult.prompt;

      // Update prompt span with success
      if (promptSpan) {
        langfuseService.updateElement(promptSpan, {
          output: {
            promptLength: finalPrompt.length,
            variablesInjected: promptContext.variables ? Object.keys(promptContext.variables) : [],
            promptVersion: promptResult.version,
            cached: promptResult.cached,
          },
          metadata: {
            promptName: this.getPromptName(),
            promptVersion: promptResult.version,
            variableCount: promptContext.variables ? Object.keys(promptContext.variables).length : 0,
            cached: promptResult.cached,
          },
        });
        langfuseService.endElement(promptSpan);
      }

      // Store prompt span in context for potential later use
      if (tracingContext) {
        tracingContext.promptSpan = promptSpan;
      }

      return finalPrompt;

    } catch (error) {
      if (promptSpan) {
        langfuseService.updateElement(promptSpan, {
          output: { error: error instanceof Error ? error.message : 'Unknown error' },
          level: 'ERROR',
        });
        langfuseService.endElement(promptSpan);
      }

      throw new AgentError(
        AgentErrorType.PROMPT_FETCH_ERROR,
        `Failed to fetch and prepare prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          promptName: this.getPromptName(),
          agentName: this.getAgentName() 
        },
        tracingContext?.trace?.id
      );
    }
  }

  /**
   * Finalize successful tracing
   */
  private async finalizeSucessfulTracing(
    tracingContext: AgentTracingContext,
    result: {
      finalResponse: string;
      finalResponseParsed: TOutput;
      totalIterations: number;
      functionCalls: any[];
      metrics?: Partial<AgentMetrics>;
    },
    executionMetadata: AgentExecutionResult<TOutput>['executionMetadata']
  ): Promise<void> {
    try {
      // Update execution span
      if (tracingContext.executionSpan) {
        langfuseService.updateElement(tracingContext.executionSpan, {
          output: {
            success: true,
            iterations: result.totalIterations,
            functionCalls: result.functionCalls.length,
            responseLength: result.finalResponse.length,
            duration: executionMetadata?.duration,
          },
          metadata: {
            success: true,
            totalIterations: result.totalIterations,
            functionCallCount: result.functionCalls.length,
            executionTime: executionMetadata?.duration,
            tokenUsage: executionMetadata?.tokenUsage,
          },
        });
        langfuseService.endElement(tracingContext.executionSpan);
      }

      // End main trace
      langfuseService.endElement(tracingContext.trace, {
        output: {
          success: true,
          finalResponse: result.finalResponse,
          iterations: result.totalIterations,
          functionCalls: result.functionCalls.length,
        },
        metadata: {
          success: true,
          completedAt: new Date().toISOString(),
          executionMetadata,
        },
      });

      // Score the execution
      if (result.metrics?.success !== false) {
        langfuseService.score(tracingContext.trace, 'execution_success', 1, 'Agent execution completed successfully');
      }

    } catch (error) {
      logger.error('Failed to finalize successful tracing', {
        agent: this.getAgentName(),
        traceId: tracingContext.trace?.id,
        error,
      });
    }
  }

  /**
   * Finalize error tracing
   */
  private async finalizeErrorTracing(
    tracingContext: AgentTracingContext,
    agentError: AgentError,
    duration: number
  ): Promise<void> {
    try {
      // Update execution span with error
      if (tracingContext.executionSpan) {
        langfuseService.updateElement(tracingContext.executionSpan, {
          output: {
            error: agentError.toJSON(),
            success: false,
            duration,
          },
          level: 'ERROR',
        });
        langfuseService.endElement(tracingContext.executionSpan);
      }

      // End main trace with error
      langfuseService.endElement(tracingContext.trace, {
        output: {
          error: agentError.toJSON(),
          success: false,
        },
        level: 'ERROR',
        metadata: {
          success: false,
          errorType: agentError.type,
          failedAt: new Date().toISOString(),
          duration,
        },
      });

      // Score the execution as failed
      langfuseService.score(tracingContext.trace, 'execution_success', 0, `Agent execution failed: ${agentError.message}`);

    } catch (error) {
      logger.error('Failed to finalize error tracing', {
        agent: this.getAgentName(),
        traceId: tracingContext.trace?.id,
        error,
      });
    }
  }

  /**
   * Handle execution errors with proper typing
   */
  private handleExecutionError(error: unknown, tracingContext: AgentTracingContext | null): AgentError {
    if (error instanceof AgentError) {
      return error;
    }

    let errorType = AgentErrorType.UNKNOWN_ERROR;
    let message = 'Unknown error occurred';
    let context: Record<string, any> = {};

    if (error instanceof Error) {
      message = error.message;
      context = {
        name: error.name,
        stack: error.stack,
      };

      // Categorize common error types
      if (error.message.includes('prompt')) {
        errorType = AgentErrorType.PROMPT_FETCH_ERROR;
      } else if (error.message.includes('parsing') || error.message.includes('JSON')) {
        errorType = AgentErrorType.OUTPUT_PARSING_ERROR;
      } else if (error.message.includes('timeout')) {
        errorType = AgentErrorType.TIMEOUT_ERROR;
      } else if (error.message.includes('validation')) {
        errorType = AgentErrorType.VALIDATION_ERROR;
      }
    }

    return new AgentError(
      errorType,
      message,
      {
        ...context,
        agentName: this.getAgentName(),
        promptName: this.getPromptName(),
      },
      tracingContext?.trace?.id
    );
  }
}