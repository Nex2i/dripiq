/**
 * Enhanced agent execution result that includes observability data
 */
export interface EnhancedAgentResult<T = any> {
  /** The final response from the agent */
  finalResponse: string;

  /** The parsed result according to the agent's schema */
  finalResponseParsed: T;

  /** Total number of iterations/tool calls made */
  totalIterations: number;

  /** Array of function calls and their results */
  functionCalls: any[];

  /** LangFuse trace ID for tracking (null if tracing disabled) */
  traceId: string | null;

  /** Additional metadata about the execution */
  metadata?: {
    /** Execution time in milliseconds */
    executionTimeMs?: number;

    /** Token usage information */
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };

    /** Agent-specific metadata */
    agentMetadata?: Record<string, any>;

    /** Error information if any */
    errors?: Array<{
      message: string;
      phase: string;
      timestamp: string;
    }>;
  };
}

/**
 * Options for agent execution with observability
 */
export interface AgentExecutionOptions {
  /** Tenant ID for tracing context */
  tenantId?: string;

  /** User ID for tracing context */
  userId?: string;

  /** Session ID for tracing context */
  sessionId?: string;

  /** Whether to enable LangFuse tracing */
  enableTracing?: boolean;

  /** Additional metadata to include in traces */
  metadata?: Record<string, string>;
}

/**
 * Standard metadata structure for agent traces
 */
export interface AgentTraceMetadata {
  /** Agent name */
  agentName: string;

  /** Agent version */
  agentVersion?: string;

  /** Input parameters */
  input: Record<string, any>;

  /** Tenant context */
  tenantId?: string;

  /** User context */
  userId?: string;

  /** Session context */
  sessionId?: string;

  /** Additional custom metadata */
  custom?: Record<string, string>;
}
