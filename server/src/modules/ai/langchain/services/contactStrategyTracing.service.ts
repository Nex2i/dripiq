import { logger } from '@/libs/logger';
import { getLangfuseClient } from '../config/langfuse.config';

export interface ContactStrategyTraceMetadata {
  tenantId: string;
  leadId: string;
  contactId: string;
  userId?: string;
  leadName?: string;
  contactName?: string;
  partnerName?: string;
}

export interface ContactStrategyTraceResult {
  success: boolean;
  totalIterations: number;
  executionTimeMs: number;
  emailsGenerated: number;
  error?: string;
  promptVersion?: number;
  functionCallsCount?: number;
}

export class ContactStrategyTracingService {
  /**
   * Creates a trace for a contact strategy generation
   */
  createTrace(metadata: ContactStrategyTraceMetadata) {
    try {
      const langfuse = getLangfuseClient();

      const trace = langfuse.trace({
        name: 'contact_strategy_generation',
        userId: metadata.userId,
        metadata: {
          tenantId: metadata.tenantId,
          leadId: metadata.leadId,
          contactId: metadata.contactId,
          leadName: metadata.leadName,
          contactName: metadata.contactName,
          partnerName: metadata.partnerName,
        },
        tags: ['contact_strategy', 'email_generation', 'campaign_creation'],
      });

      logger.debug('Created LangFuse trace for contact strategy', {
        traceId: trace.id,
        leadId: metadata.leadId,
        contactId: metadata.contactId,
      });

      return trace;
    } catch (error) {
      logger.error('Failed to create LangFuse trace for contact strategy', error);
      throw error;
    }
  }

  /**
   * Creates a generation span for the agent execution
   */
  createGeneration(trace: any, systemPrompt: string, model: string, inputData: any) {
    try {
      const generation = trace.generation({
        name: 'contact_strategy_agent_execution',
        input: {
          systemPrompt: systemPrompt.substring(0, 500) + '...', // Truncate for readability
          leadDetails: inputData.lead_details?.value || {},
          contactDetails: inputData.contact_details?.value || {},
          partnerDetails: inputData.partner_details?.value || {},
          partnerProducts: inputData.partner_products?.value || [],
          salesman: inputData.salesman?.value || {},
        },
        model,
        metadata: {
          purpose: 'email_content_generation',
          maxIterations: inputData.maxIterations,
        },
      });

      logger.debug('Created generation span for contact strategy agent', {
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
   */
  endGeneration(
    generation: any,
    output: string,
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ) {
    try {
      generation.end({
        output: output.substring(0, 1000) + (output.length > 1000 ? '...' : ''), // Truncate large outputs
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
      });

      logger.debug('Ended generation span for contact strategy', {
        outputLength: output.length,
        totalTokens: usage?.totalTokens,
      });
    } catch (error) {
      logger.error('Failed to end generation span', error);
    }
  }

  /**
   * Records function/tool calls made during agent execution
   */
  recordToolCall(trace: any, toolName: string, toolInput: any, toolOutput: any) {
    try {
      trace.span({
        name: `tool_call_${toolName}`,
        input: toolInput,
        output: typeof toolOutput === 'string' ? toolOutput.substring(0, 500) : toolOutput,
        metadata: {
          toolName,
        },
      });

      logger.debug('Recorded tool call in trace', {
        traceId: trace.id,
        toolName,
      });
    } catch (error) {
      logger.error('Failed to record tool call', error);
    }
  }

  /**
   * Records the final result of contact strategy generation
   */
  recordResult(trace: any, result: ContactStrategyTraceResult) {
    try {
      trace.update({
        output: {
          success: result.success,
          emailsGenerated: result.emailsGenerated,
          totalIterations: result.totalIterations,
          functionCallsCount: result.functionCallsCount,
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

      logger.info('Recorded contact strategy result in LangFuse', {
        traceId: trace.id,
        success: result.success,
        emailsGenerated: result.emailsGenerated,
        executionTimeMs: result.executionTimeMs,
      });
    } catch (error) {
      logger.error('Failed to record result in trace', error);
    }
  }

  /**
   * Records an error in the trace
   */
  recordError(trace: any, error: Error, stage?: string) {
    try {
      trace.update({
        level: 'ERROR',
        statusMessage: error.message,
        output: {
          error: error.message,
          stack: error.stack,
          stage: stage || 'unknown',
        },
      });

      logger.error('Recorded error in contact strategy trace', {
        traceId: trace.id,
        error: error.message,
        stage,
      });
    } catch (err) {
      logger.error('Failed to record error in trace', err);
    }
  }

  /**
   * Records validation errors for campaign plan mapping
   */
  recordValidationError(trace: any, stage: string, validationError: any) {
    try {
      trace.event({
        name: 'validation_error',
        metadata: {
          stage,
          error: validationError,
        },
        level: 'ERROR',
      });

      logger.warn('Recorded validation error in trace', {
        traceId: trace.id,
        stage,
      });
    } catch (error) {
      logger.error('Failed to record validation error', error);
    }
  }
}

export const contactStrategyTracingService = new ContactStrategyTracingService();
