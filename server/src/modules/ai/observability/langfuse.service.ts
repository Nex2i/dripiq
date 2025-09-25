import { Langfuse } from 'langfuse';
import { logger } from '@/libs/logger';

export interface LangFuseConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  enabled?: boolean;
  debug?: boolean;
  flushAt?: number;
  flushInterval?: number;
}

export interface TraceOptions {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface GenerationOptions {
  name?: string;
  model?: string;
  input?: any;
  output?: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

export interface SpanOptions {
  name: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
}

export interface EventOptions {
  name: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
}

export class LangFuseService {
  private client: Langfuse | null = null;
  private isEnabled: boolean = false;
  private isInitialized: boolean = false;

  constructor(config?: LangFuseConfig) {
    this.initialize(config);
  }

  private initialize(config?: LangFuseConfig): void {
    try {
      const finalConfig = {
        publicKey: config?.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: config?.secretKey || process.env.LANGFUSE_SECRET_KEY,
        baseUrl: config?.baseUrl || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
        enabled: config?.enabled ?? (process.env.LANGFUSE_ENABLED === 'true'),
        debug: config?.debug ?? (process.env.LANGFUSE_DEBUG === 'true'),
        flushAt: config?.flushAt ? parseInt(config.flushAt.toString()) : parseInt(process.env.LANGFUSE_FLUSH_AT || '10'),
        flushInterval: config?.flushInterval ? parseInt(config.flushInterval.toString()) : parseInt(process.env.LANGFUSE_FLUSH_INTERVAL || '1000'),
      };

      if (!finalConfig.enabled) {
        logger.info('LangFuse is disabled via configuration');
        this.isEnabled = false;
        this.isInitialized = true;
        return;
      }

      if (!finalConfig.publicKey || !finalConfig.secretKey) {
        logger.warn('LangFuse configuration incomplete - missing API keys');
        this.isEnabled = false;
        this.isInitialized = true;
        return;
      }

      this.client = new Langfuse({
        publicKey: finalConfig.publicKey,
        secretKey: finalConfig.secretKey,
        baseUrl: finalConfig.baseUrl,
        debug: finalConfig.debug,
        flushAt: finalConfig.flushAt,
        flushInterval: finalConfig.flushInterval,
      });

      this.isEnabled = true;
      this.isInitialized = true;

      logger.info('LangFuse service initialized successfully', {
        baseUrl: finalConfig.baseUrl,
        debug: finalConfig.debug,
        flushAt: finalConfig.flushAt,
        flushInterval: finalConfig.flushInterval,
      });
    } catch (error) {
      logger.error('Failed to initialize LangFuse service', error);
      this.isEnabled = false;
      this.isInitialized = true;
    }
  }

  /**
   * Check if LangFuse is enabled and properly initialized
   */
  public isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Wait for initialization to complete
   */
  public async waitForInitialization(): Promise<void> {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Create a new trace for agent execution
   */
  public createTrace(name: string, options?: TraceOptions) {
    if (!this.isAvailable()) {
      logger.debug('LangFuse not available, skipping trace creation', { name });
      return null;
    }

    try {
      const trace = this.client!.trace({
        name,
        userId: options?.userId,
        sessionId: options?.sessionId,
        metadata: {
          ...options?.metadata,
          tenantId: options?.tenantId,
          timestamp: new Date().toISOString(),
        },
        tags: options?.tags,
      });

      logger.debug('LangFuse trace created', { 
        name, 
        traceId: trace.id,
        tenantId: options?.tenantId,
        userId: options?.userId,
        sessionId: options?.sessionId 
      });

      return trace;
    } catch (error) {
      logger.error('Failed to create LangFuse trace', { name, error });
      return null;
    }
  }

  /**
   * Create a generation within a trace
   */
  public createGeneration(trace: any, options: GenerationOptions) {
    if (!this.isAvailable() || !trace) {
      logger.debug('LangFuse not available or no trace, skipping generation creation');
      return null;
    }

    try {
      const generation = trace.generation({
        name: options.name || 'AI Generation',
        model: options.model,
        input: options.input,
        output: options.output,
        usage: options.usage,
        metadata: {
          ...options.metadata,
          timestamp: new Date().toISOString(),
        },
      });

      logger.debug('LangFuse generation created', { 
        name: options.name,
        model: options.model,
        generationId: generation.id 
      });

      return generation;
    } catch (error) {
      logger.error('Failed to create LangFuse generation', { options, error });
      return null;
    }
  }

  /**
   * Create a span within a trace
   */
  public createSpan(trace: any, options: SpanOptions) {
    if (!this.isAvailable() || !trace) {
      logger.debug('LangFuse not available or no trace, skipping span creation');
      return null;
    }

    try {
      const span = trace.span({
        name: options.name,
        input: options.input,
        output: options.output,
        metadata: {
          ...options.metadata,
          timestamp: new Date().toISOString(),
        },
        level: options.level || 'DEFAULT',
      });

      logger.debug('LangFuse span created', { 
        name: options.name,
        spanId: span.id 
      });

      return span;
    } catch (error) {
      logger.error('Failed to create LangFuse span', { options, error });
      return null;
    }
  }

  /**
   * Create an event within a trace
   */
  public createEvent(trace: any, options: EventOptions) {
    if (!this.isAvailable() || !trace) {
      logger.debug('LangFuse not available or no trace, skipping event creation');
      return null;
    }

    try {
      const event = trace.event({
        name: options.name,
        input: options.input,
        output: options.output,
        metadata: {
          ...options.metadata,
          timestamp: new Date().toISOString(),
        },
        level: options.level || 'DEFAULT',
      });

      logger.debug('LangFuse event created', { 
        name: options.name,
        eventId: event.id 
      });

      return event;
    } catch (error) {
      logger.error('Failed to create LangFuse event', { options, error });
      return null;
    }
  }

  /**
   * Update an existing trace, generation, span, or event
   */
  public updateElement(element: any, updates: {
    output?: any;
    metadata?: Record<string, any>;
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
    endTime?: Date;
  }) {
    if (!this.isAvailable() || !element) {
      logger.debug('LangFuse not available or no element, skipping update');
      return;
    }

    try {
      element.update({
        output: updates.output,
        metadata: updates.metadata,
        level: updates.level,
        endTime: updates.endTime,
      });

      logger.debug('LangFuse element updated', { 
        elementId: element.id,
        updates: Object.keys(updates) 
      });
    } catch (error) {
      logger.error('Failed to update LangFuse element', { updates, error });
    }
  }

  /**
   * End an element (trace, generation, span, or event)
   */
  public endElement(element: any, options?: {
    output?: any;
    metadata?: Record<string, any>;
    level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  }) {
    if (!this.isAvailable() || !element) {
      logger.debug('LangFuse not available or no element, skipping end');
      return;
    }

    try {
      element.end({
        output: options?.output,
        metadata: options?.metadata,
        level: options?.level,
      });

      logger.debug('LangFuse element ended', { 
        elementId: element.id 
      });
    } catch (error) {
      logger.error('Failed to end LangFuse element', { error });
    }
  }

  /**
   * Score a trace or generation
   */
  public score(element: any, name: string, value: number, comment?: string) {
    if (!this.isAvailable() || !element) {
      logger.debug('LangFuse not available or no element, skipping scoring');
      return;
    }

    try {
      element.score({
        name,
        value,
        comment,
      });

      logger.debug('LangFuse element scored', { 
        elementId: element.id,
        scoreName: name,
        scoreValue: value 
      });
    } catch (error) {
      logger.error('Failed to score LangFuse element', { name, value, error });
    }
  }

  /**
   * Flush all pending events to LangFuse
   */
  public async flush(): Promise<void> {
    if (!this.isAvailable()) {
      logger.debug('LangFuse not available, skipping flush');
      return;
    }

    try {
      await this.client!.flushAsync();
      logger.debug('LangFuse events flushed successfully');
    } catch (error) {
      logger.error('Failed to flush LangFuse events', error);
    }
  }

  /**
   * Shutdown the LangFuse client
   */
  public async shutdown(): Promise<void> {
    if (!this.isAvailable()) {
      logger.debug('LangFuse not available, skipping shutdown');
      return;
    }

    try {
      await this.client!.shutdownAsync();
      logger.info('LangFuse service shutdown successfully');
    } catch (error) {
      logger.error('Failed to shutdown LangFuse service', error);
    }
  }

  /**
   * Get health status of the LangFuse service
   */
  public getHealthStatus(): {
    isEnabled: boolean;
    isInitialized: boolean;
    isAvailable: boolean;
    client: boolean;
  } {
    return {
      isEnabled: this.isEnabled,
      isInitialized: this.isInitialized,
      isAvailable: this.isAvailable(),
      client: this.client !== null,
    };
  }
}

// Singleton instance
export const langfuseService = new LangFuseService();