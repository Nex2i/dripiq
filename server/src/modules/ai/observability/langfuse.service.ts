import { Langfuse } from 'langfuse';
import { logger } from '@/libs/logger';

// Import CallbackHandler type - we'll create a simple interface since the actual implementation might vary
interface CallbackHandler {
  // This would be the actual LangChain callback handler interface
  handleLLMStart?: (llm: any, prompts: string[], runId: string) => void;
  handleLLMEnd?: (output: any, runId: string) => void;
  handleLLMError?: (error: any, runId: string) => void;
}

export interface LangFuseConfig {
  publicKey?: string;
  secretKey?: string;
  host?: string;
  enabled?: boolean;
  debug?: boolean;
  flushAt?: number;
  flushInterval?: number;
}

export interface TracingMetadata {
  userId?: string;
  tenantId?: string;
  leadId?: string;
  contactId?: string;
  agentType?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

class LangFuseService {
  private langfuse: Langfuse | null = null;
  private isEnabled: boolean = false;
  private config: LangFuseConfig;

  constructor() {
    this.config = {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
      enabled: process.env.LANGFUSE_ENABLED === 'true',
      debug: process.env.LANGFUSE_DEBUG === 'true',
      flushAt: parseInt(process.env.LANGFUSE_FLUSH_AT || '10'),
      flushInterval: parseInt(process.env.LANGFUSE_FLUSH_INTERVAL || '1000'),
    };

    this.initialize();
  }

  private initialize(): void {
    try {
      if (!this.config.enabled) {
        logger.info('LangFuse observability is disabled');
        return;
      }

      if (!this.config.publicKey || !this.config.secretKey) {
        logger.warn('LangFuse credentials not provided. Observability will be disabled.');
        return;
      }

      this.langfuse = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.host,
        flushAt: this.config.flushAt,
        flushInterval: this.config.flushInterval,
      });

      this.isEnabled = true;
      logger.info('LangFuse observability service initialized successfully', {
        host: this.config.host,
        debug: this.config.debug,
      });
    } catch (error) {
      logger.error('Failed to initialize LangFuse service:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Get LangChain callback handler for tracing
   */
  public getCallbackHandler(metadata?: TracingMetadata): CallbackHandler | null {
    if (!this.isEnabled || !this.langfuse) {
      return null;
    }

    try {
      // Create a simple callback handler for now
      // In a real implementation, this would be the actual LangChain-LangFuse integration
      const handler: CallbackHandler = {
        handleLLMStart: (llm: any, prompts: string[], runId: string) => {
          this.logEvent('llm_start', { prompts, runId, llm }, metadata);
        },
        handleLLMEnd: (output: any, runId: string) => {
          this.logEvent('llm_end', { output, runId }, metadata);
        },
        handleLLMError: (error: any, runId: string) => {
          this.logEvent('llm_error', { error: error.message, runId }, metadata);
        },
      };

      return handler;
    } catch (error) {
      logger.error('Failed to create LangFuse callback handler:', error);
      return null;
    }
  }

  /**
   * Create a new trace
   */
  public createTrace(name: string, metadata?: TracingMetadata) {
    if (!this.isEnabled || !this.langfuse) {
      return null;
    }

    try {
      return this.langfuse.trace({
        name,
        metadata: {
          tenantId: metadata?.tenantId,
          leadId: metadata?.leadId,
          contactId: metadata?.contactId,
          agentType: metadata?.agentType,
          userId: metadata?.userId,
          sessionId: metadata?.sessionId,
          ...metadata?.metadata,
        },
      });
    } catch (error) {
      logger.error('Failed to create LangFuse trace:', error);
      return null;
    }
  }

  /**
   * Log an event
   */
  public logEvent(name: string, input: any, metadata?: TracingMetadata) {
    if (!this.isEnabled || !this.langfuse) {
      return;
    }

    try {
      this.langfuse.event({
        name,
        input,
        metadata: {
          tenantId: metadata?.tenantId,
          leadId: metadata?.leadId,
          contactId: metadata?.contactId,
          agentType: metadata?.agentType,
          userId: metadata?.userId,
          sessionId: metadata?.sessionId,
          ...metadata?.metadata,
        },
      });
    } catch (error) {
      logger.error('Failed to log LangFuse event:', error);
    }
  }

  /**
   * Score a trace or generation
   */
  public score(traceId: string, name: string, value: number, comment?: string) {
    if (!this.isEnabled || !this.langfuse) {
      return;
    }

    try {
      this.langfuse.score({
        traceId,
        name,
        value,
        comment,
      });
    } catch (error) {
      logger.error('Failed to score LangFuse trace:', error);
    }
  }

  /**
   * Flush pending events
   */
  public async flush(): Promise<void> {
    if (!this.isEnabled || !this.langfuse) {
      return;
    }

    try {
      await this.langfuse.flush();
    } catch (error) {
      logger.error('Failed to flush LangFuse events:', error);
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    if (!this.isEnabled || !this.langfuse) {
      return;
    }

    try {
      await this.langfuse.shutdown();
      logger.info('LangFuse service shutdown successfully');
    } catch (error) {
      logger.error('Failed to shutdown LangFuse service:', error);
    }
  }

  /**
   * Get the LangFuse client instance
   */
  public getClient(): Langfuse | null {
    return this.langfuse;
  }

  /**
   * Check if LangFuse is enabled and ready
   */
  public isReady(): boolean {
    return this.isEnabled && this.langfuse !== null;
  }

  /**
   * Create a dataset for evaluations
   */
  public createDataset(name: string, description?: string) {
    if (!this.isEnabled || !this.langfuse) {
      return null;
    }

    try {
      return this.langfuse.createDataset({
        name,
        description,
      });
    } catch (error) {
      logger.error('Failed to create LangFuse dataset:', error);
      return null;
    }
  }

  /**
   * Add item to dataset
   */
  public createDatasetItem(datasetName: string, input: any, expectedOutput?: any, metadata?: any) {
    if (!this.isEnabled || !this.langfuse) {
      return null;
    }

    try {
      return this.langfuse.createDatasetItem({
        datasetName,
        input,
        expectedOutput,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to create LangFuse dataset item:', error);
      return null;
    }
  }
}

// Export singleton instance
export const langfuseService = new LangFuseService();
