import { Langfuse } from 'langfuse';
import { logger } from '@/libs/logger';

export interface LangFuseConfig {
  publicKey: string;
  secretKey: string;
  host: string;
  enabled: boolean;
  debug?: boolean;
  flushAt?: number;
  flushInterval?: number;
}

export interface TraceMetadata {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  campaign?: string;
  source?: string;
  [key: string]: string | undefined;
}

export interface AgentExecutionContext {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  enableTracing?: boolean;
  metadata?: Record<string, string>;
}

export interface TraceResult {
  traceId: string | null;
  trace: any | null;
}

/**
 * LangFuse Service - Centralized LangFuse client management
 *
 * Provides enterprise-grade observability, tracing, and analytics for AI agents.
 * Features:
 * - Automatic trace creation and management
 * - Event logging with rich metadata
 * - Error tracking and performance metrics
 * - Graceful degradation when LangFuse is unavailable
 */
export class LangFuseService {
  private client: Langfuse | null = null;
  private isEnabled: boolean = false;
  private config: LangFuseConfig;

  constructor(config: LangFuseConfig) {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    if (!this.config.enabled) {
      logger.info('LangFuse is disabled - observability features will not be available');
      return;
    }

    if (!this.config.publicKey || !this.config.secretKey || !this.config.host) {
      logger.warn('LangFuse configuration incomplete - observability features disabled', {
        hasPublicKey: !!this.config.publicKey,
        hasSecretKey: !!this.config.secretKey,
        hasHost: !!this.config.host,
      });
      return;
    }

    try {
      this.client = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.host,
        flushAt: this.config.flushAt || 10,
        flushInterval: this.config.flushInterval || 1000,
      });

      this.isEnabled = true;
      logger.info('LangFuse client initialized successfully', {
        host: this.config.host,
        debug: this.config.debug,
        flushAt: this.config.flushAt,
        flushInterval: this.config.flushInterval,
      });
    } catch (error) {
      logger.error('Failed to initialize LangFuse client', error);
      this.isEnabled = false;
    }
  }

  /**
   * Check if LangFuse is enabled and available
   */
  public isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Create a new trace for agent execution
   */
  public createTrace(name: string, input?: any, metadata?: TraceMetadata): TraceResult {
    if (!this.isAvailable()) {
      logger.debug('LangFuse not available - skipping trace creation', { name });
      return { traceId: null, trace: null };
    }

    try {
      const trace = this.client!.trace({
        name,
        input,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'unknown',
        },
      });

      logger.debug('Trace created successfully', {
        name,
        traceId: trace.id,
        metadata,
      });

      return { traceId: trace.id, trace };
    } catch (error) {
      logger.error('Failed to create trace', { name, error });
      return { traceId: null, trace: null };
    }
  }

  /**
   * Update an existing trace with results
   */
  public updateTrace(trace: any, output?: any, metadata?: Record<string, any>): void {
    if (!this.isAvailable() || !trace) {
      return;
    }

    try {
      trace.update({
        output,
        metadata: {
          ...metadata,
          completedAt: new Date().toISOString(),
        },
      });

      logger.debug('Trace updated successfully', {
        traceId: trace.id,
        hasOutput: !!output,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to update trace', { traceId: trace.id, error });
    }
  }

  /**
   * Log an event within a trace
   */
  public logEvent(
    trace: any,
    name: string,
    input?: any,
    output?: any,
    metadata?: Record<string, any>
  ): void {
    if (!this.isAvailable() || !trace) {
      return;
    }

    try {
      trace.event({
        name,
        input,
        output,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });

      logger.debug('Event logged successfully', {
        traceId: trace.id,
        eventName: name,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to log event', {
        traceId: trace.id,
        eventName: name,
        error,
      });
    }
  }

  /**
   * Log an error event within a trace
   */
  public logError(trace: any, error: Error, context?: Record<string, any>): void {
    if (!this.isAvailable() || !trace) {
      return;
    }

    try {
      trace.event({
        name: 'error',
        input: context,
        output: {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        metadata: {
          level: 'error',
          timestamp: new Date().toISOString(),
          ...context,
        },
      });

      logger.debug('Error event logged successfully', {
        traceId: trace.id,
        errorName: error.name,
        errorMessage: error.message,
      });
    } catch (logError) {
      logger.error('Failed to log error event', {
        traceId: trace.id,
        originalError: error.message,
        logError,
      });
    }
  }

  /**
   * Create a span within a trace for detailed operation tracking
   */
  public createSpan(
    trace: any,
    name: string,
    input?: any,
    metadata?: Record<string, any>
  ): any | null {
    if (!this.isAvailable() || !trace) {
      return null;
    }

    try {
      const span = trace.span({
        name,
        input,
        metadata: {
          ...metadata,
          startTime: new Date().toISOString(),
        },
      });

      logger.debug('Span created successfully', {
        traceId: trace.id,
        spanName: name,
        spanId: span.id,
      });

      return span;
    } catch (error) {
      logger.error('Failed to create span', {
        traceId: trace.id,
        spanName: name,
        error,
      });
      return null;
    }
  }

  /**
   * Update a span with results
   */
  public updateSpan(span: any, output?: any, metadata?: Record<string, any>): void {
    if (!this.isAvailable() || !span) {
      return;
    }

    try {
      span.update({
        output,
        metadata: {
          ...metadata,
          endTime: new Date().toISOString(),
        },
      });

      logger.debug('Span updated successfully', {
        spanId: span.id,
        hasOutput: !!output,
      });
    } catch (error) {
      logger.error('Failed to update span', { spanId: span.id, error });
    }
  }

  /**
   * Manually flush all pending traces and events
   */
  public async flush(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.client!.flushAsync();
      logger.debug('LangFuse client flushed successfully');
    } catch (error) {
      logger.error('Failed to flush LangFuse client', error);
    }
  }

  /**
   * Shutdown the LangFuse client gracefully
   */
  public async shutdown(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.client!.shutdownAsync();
      logger.info('LangFuse client shutdown successfully');
    } catch (error) {
      logger.error('Failed to shutdown LangFuse client', error);
    } finally {
      this.isEnabled = false;
      this.client = null;
    }
  }

  /**
   * Get client configuration for debugging
   */
  public getConfig(): Partial<LangFuseConfig> {
    return {
      host: this.config.host,
      enabled: this.config.enabled,
      debug: this.config.debug,
      flushAt: this.config.flushAt,
      flushInterval: this.config.flushInterval,
    };
  }

  /**
   * Get the underlying LangFuse client for advanced operations
   * Used internally by PromptService for direct API access
   */
  public getClient(): any {
    if (!this.isAvailable()) {
      throw new Error('LangFuse client is not available');
    }
    return this.client;
  }
}

// Create and export singleton instance
export const createLangFuseService = (config: LangFuseConfig): LangFuseService => {
  return new LangFuseService(config);
};
