import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/libs/logger';
import { supabaseStorage } from '@/libs/supabase.storage';

export type AgentType = 'contact-extraction' | 'contact-strategy' | 'site-analysis' | 'vendor-fit';

export interface ConversationInput {
  domain?: string;
  leadId?: string;
  contactId?: string;
  partnerInfo?: any;
  opportunityContext?: string;
  parameters?: Record<string, any>;
}

export interface ConversationStep {
  stepNumber: number;
  action: {
    tool?: string;
    toolInput?: any;
    log?: string;
  };
  observation: any;
  timestamp: string;
}

export interface ConversationMetrics {
  durationMs: number;
  tokensUsed?: number;
  cost?: number;
  modelUsed?: string;
}

export interface ConversationOutput {
  // Metadata
  conversationId: string;
  tenantId: string;
  leadId?: string;
  contactId?: string;
  agentType: AgentType;
  timestamp: string;

  // Input context
  input: ConversationInput;

  // Conversation flow
  conversation: {
    systemPrompt: string;
    totalIterations: number;
    intermediateSteps: ConversationStep[];
    finalResponse: string;
    finalResponseParsed: any;
  };

  // Performance metrics
  metrics: ConversationMetrics;

  // Status
  status: 'success' | 'error' | 'partial';
  error?: string;
}

export class ConversationStorageService {
  private static get STORAGE_ENABLED(): boolean {
    return process.env.CONVERSATION_STORAGE_ENABLED !== 'false';
  }

  private static readonly STORAGE_BUCKET = process.env.SITE_STORAGE_BUCKET;

  /**
   * Generate a storage path for a conversation
   */
  private static generatePath(agentType: AgentType): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_');

    return `${agentType}/${timestamp}-details.json`;
  }

  /**
   * Generate a unique conversation ID
   */
  static generateConversationId(): string {
    return uuidv4();
  }

  /**
   * Create conversation metadata
   */
  static createConversationMetadata(
    agentType: AgentType,
    tenantId: string,
    input: ConversationInput,
    conversationId?: string
  ): Partial<ConversationOutput> {
    return {
      conversationId: conversationId || this.generateConversationId(),
      tenantId,
      leadId: input.leadId,
      contactId: input.contactId,
      agentType,
      timestamp: new Date().toISOString(),
      input,
      status: 'success',
    };
  }

  /**
   * Transform agent intermediate steps to conversation steps
   */
  static transformIntermediateSteps(intermediateSteps: any[]): ConversationStep[] {
    return (intermediateSteps || []).map((step, index) => ({
      stepNumber: index + 1,
      action: {
        tool: step.action?.tool || 'unknown',
        toolInput: step.action?.toolInput || step.action?.input,
        log: step.action?.log,
      },
      observation: step.observation,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Save a conversation to Supabase storage
   */
  static async saveConversation(
    agentType: AgentType,
    conversationData: ConversationOutput
  ): Promise<void> {
    if (!this.STORAGE_ENABLED) {
      logger.debug('Conversation storage is disabled, skipping save');
      return;
    }

    try {
      const path = this.generatePath(agentType);

      logger.debug(`Saving conversation to: ${path}`, {
        conversationId: conversationData.conversationId,
        agentType,
        tenantId: conversationData.tenantId,
      });

      await supabaseStorage.uploadJsonFile(path, conversationData);

      logger.info(`Successfully saved conversation`, {
        conversationId: conversationData.conversationId,
        agentType,
        tenantId: conversationData.tenantId,
        path,
      });
    } catch (error) {
      logger.error('Failed to save conversation to storage', {
        error,
        conversationId: conversationData.conversationId,
        agentType,
        tenantId: conversationData.tenantId,
      });
      // Don't throw - storage failures shouldn't break agent execution
    }
  }

  /**
   * Save conversation asynchronously (fire and forget)
   */
  static saveConversationAsync(agentType: AgentType, conversationData: ConversationOutput): void {
    // Fire and forget - don't await
    this.saveConversation(agentType, conversationData).catch((error) => {
      logger.error('Async conversation save failed', {
        error,
        conversationId: conversationData.conversationId,
        agentType,
      });
    });
  }

  /**
   * Create conversation output from agent result
   */
  static createConversationOutput(
    metadata: Partial<ConversationOutput>,
    systemPrompt: string,
    agentResult: any,
    startTime: number,
    error?: Error
  ): ConversationOutput {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    return {
      conversationId: metadata.conversationId!,
      tenantId: metadata.tenantId!,
      leadId: metadata.leadId,
      contactId: metadata.contactId,
      agentType: metadata.agentType!,
      timestamp: metadata.timestamp!,
      input: metadata.input!,
      conversation: {
        systemPrompt,
        totalIterations: agentResult?.intermediateSteps?.length || 0,
        intermediateSteps: this.transformIntermediateSteps(agentResult?.intermediateSteps || []),
        finalResponse: agentResult?.output || '',
        finalResponseParsed: agentResult?.finalResponseParsed || null,
      },
      metrics: {
        durationMs,
        modelUsed: 'gpt-4', // Could be made configurable
      },
      status: error ? 'error' : 'success',
      error: error?.message,
    };
  }
}
