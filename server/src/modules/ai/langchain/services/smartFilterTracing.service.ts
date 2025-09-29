import { logger } from '@/libs/logger';
import { getLangfuseClient } from '../config/langfuse.config';

export interface SmartFilterTraceMetadata {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  domain?: string;
  siteType: 'lead_site' | 'organization_site';
  inputUrlCount: number;
  minUrls: number;
  maxUrls: number;
}

export interface SmartFilterTraceResult {
  outputUrlCount: number;
  executionTimeMs: number;
  success: boolean;
  error?: string;
  usedFallback?: boolean;
  promptVersion?: number;
}

export class SmartFilterTracingService {
  /**
   * Creates a trace for a smartFilter execution
   * @param metadata - Metadata about the filter execution
   * @returns Trace object and span for tracking
   */
  createTrace(metadata: SmartFilterTraceMetadata) {
    try {
      const langfuse = getLangfuseClient();

      const trace = langfuse.trace({
        name: 'smart_filter_site_map',
        metadata: {
          tenantId: metadata.tenantId,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          domain: metadata.domain,
          siteType: metadata.siteType,
          inputUrlCount: metadata.inputUrlCount,
          minUrls: metadata.minUrls,
          maxUrls: metadata.maxUrls,
        },
        tags: ['smart_filter', 'site_scrape', metadata.siteType],
      });

      logger.debug('Created LangFuse trace for smartFilter', {
        traceId: trace.id,
        siteType: metadata.siteType,
        inputUrlCount: metadata.inputUrlCount,
      });

      return trace;
    } catch (error) {
      logger.error('Failed to create LangFuse trace for smartFilter', error);
      throw error;
    }
  }

  /**
   * Creates a generation span for the LLM call within a trace
   * @param trace - Parent trace object
   * @param input - Input to the LLM
   * @param model - Model name
   * @returns Generation span
   */
  createGeneration(trace: any, input: string, model: string) {
    try {
      const generation = trace.generation({
        name: 'smart_filter_llm_call',
        input,
        model,
        metadata: {
          purpose: 'url_filtering',
        },
      });

      logger.debug('Created generation span for smartFilter LLM call', {
        traceId: trace.id,
        model,
      });

      return generation;
    } catch (error) {
      logger.error('Failed to create generation span', error);
      throw error;
    }
  }

  /**
   * Ends a generation span with output and usage metrics
   * @param generation - Generation span to end
   * @param output - Output from the LLM
   * @param usage - Token usage statistics
   */
  endGeneration(
    generation: any,
    output: string,
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ) {
    try {
      generation.end({
        output,
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
      });

      logger.debug('Ended generation span for smartFilter', {
        outputLength: output.length,
        totalTokens: usage?.totalTokens,
      });
    } catch (error) {
      logger.error('Failed to end generation span', error);
    }
  }

  /**
   * Records the final result of a smartFilter execution
   * @param trace - Trace object
   * @param result - Result data
   */
  recordResult(trace: any, result: SmartFilterTraceResult) {
    try {
      trace.update({
        output: {
          outputUrlCount: result.outputUrlCount,
          success: result.success,
          usedFallback: result.usedFallback,
        },
        metadata: {
          executionTimeMs: result.executionTimeMs,
          promptVersion: result.promptVersion,
        },
      });

      if (result.error) {
        trace.update({
          level: 'ERROR',
          statusMessage: result.error,
        });
      }

      logger.info('Recorded smartFilter result in LangFuse', {
        traceId: trace.id,
        success: result.success,
        outputUrlCount: result.outputUrlCount,
        executionTimeMs: result.executionTimeMs,
      });
    } catch (error) {
      logger.error('Failed to record result in trace', error);
    }
  }

  /**
   * Records an error in the trace
   * @param trace - Trace object
   * @param error - Error that occurred
   */
  recordError(trace: any, error: Error) {
    try {
      trace.update({
        level: 'ERROR',
        statusMessage: error.message,
        output: {
          error: error.message,
          stack: error.stack,
        },
      });

      logger.error('Recorded error in smartFilter trace', {
        traceId: trace.id,
        error: error.message,
      });
    } catch (err) {
      logger.error('Failed to record error in trace', err);
    }
  }
}

export const smartFilterTracingService = new SmartFilterTracingService();
