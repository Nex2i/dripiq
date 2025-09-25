/**
 * Enhanced agent execution options with observability support
 */
export interface AgentExecutionOptions {
  /** Tenant ID for multi-tenancy support */
  tenantId?: string;
  /** User ID for user-specific tracking */
  userId?: string;
  /** Session ID for session tracking */
  sessionId?: string;
  /** Enable/disable tracing for this execution */
  enableTracing?: boolean;
  /** Custom metadata to include in traces */
  metadata?: Record<string, any>;
  /** Custom tags for categorization */
  tags?: string[];
  /** Custom trace name override */
  traceName?: string;
}

/**
 * Enhanced agent execution result with observability data
 */
export interface AgentExecutionResult<T = any> {
  /** The final response from the agent */
  finalResponse: string;
  /** The parsed final response */
  finalResponseParsed: T;
  /** Total number of iterations performed */
  totalIterations: number;
  /** Array of function calls made during execution */
  functionCalls: any[];
  /** LangFuse trace ID if tracing was enabled */
  traceId?: string;
  /** Additional execution metadata */
  executionMetadata?: {
    startTime: Date;
    endTime: Date;
    duration: number;
    model?: string;
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}

/**
 * Agent performance metrics
 */
export interface AgentMetrics {
  /** Execution duration in milliseconds */
  duration: number;
  /** Number of iterations performed */
  iterations: number;
  /** Number of function calls made */
  functionCalls: number;
  /** Token usage statistics */
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Success/failure status */
  success: boolean;
  /** Error information if execution failed */
  error?: {
    message: string;
    type: string;
    stack?: string;
  };
}

/**
 * Base interface for observable agents
 */
export interface ObservableAgent<TInput = any, TOutput = any> {
  /**
   * Execute the agent with observability support
   */
  execute(
    input: TInput,
    options?: AgentExecutionOptions
  ): Promise<AgentExecutionResult<TOutput>>;

  /**
   * Get agent-specific metadata
   */
  getAgentMetadata(): {
    name: string;
    version: string;
    promptName: string;
    description?: string;
  };
}

/**
 * Prompt injection context for agents
 */
export interface PromptInjectionContext {
  /** Primary domain or input parameter */
  domain?: string;
  /** Any additional variables to inject */
  variables?: Record<string, any>;
  /** Schema information */
  schemas?: {
    input?: any;
    output?: any;
  };
}

/**
 * Agent tracing context
 */
export interface AgentTracingContext {
  /** LangFuse trace instance */
  trace: any;
  /** Agent execution span */
  executionSpan?: any;
  /** Prompt generation span */
  promptSpan?: any;
  /** Current generation for LLM calls */
  currentGeneration?: any;
  /** Agent execution options */
  options: AgentExecutionOptions;
  /** Agent metadata */
  agentMetadata: {
    name: string;
    version: string;
    promptName: string;
    description?: string;
  };
}

/**
 * Tool execution context for tracing
 */
export interface ToolExecutionContext {
  /** Tool name */
  toolName: string;
  /** Tool input parameters */
  input: any;
  /** Tool execution result */
  output?: any;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Error if tool execution failed */
  error?: Error;
}

/**
 * Standard error types for agent execution
 */
export enum AgentErrorType {
  PROMPT_FETCH_ERROR = 'PROMPT_FETCH_ERROR',
  PROMPT_INJECTION_ERROR = 'PROMPT_INJECTION_ERROR',
  LLM_EXECUTION_ERROR = 'LLM_EXECUTION_ERROR',
  OUTPUT_PARSING_ERROR = 'OUTPUT_PARSING_ERROR',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured agent error with observability context
 */
export class AgentError extends Error {
  public readonly type: AgentErrorType;
  public readonly context: Record<string, any>;
  public readonly traceId?: string;

  constructor(
    type: AgentErrorType,
    message: string,
    context: Record<string, any> = {},
    traceId?: string
  ) {
    super(message);
    this.name = 'AgentError';
    this.type = type;
    this.context = context;
    this.traceId = traceId;
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      traceId: this.traceId,
      stack: this.stack,
    };
  }
}