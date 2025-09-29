import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@/libs/logger';
import { createChatModel, LangChainConfig } from '../config/langchain.config';
import {
  fetchWebDataContacts,
  formatWebDataContactsForPrompt,
  mergeContactSources,
} from '../../webDataContactHelper';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import contactExtractionOutputSchema, {
  ContactExtractionOutput,
} from '../../schemas/contactExtractionSchema';
import { getContentFromMessage } from '../utils/messageUtils';
import {
  getObservabilityServices,
  type EnhancedAgentResult,
  type AgentExecutionOptions,
} from '../../observability';

export type ContactExtractionResult = EnhancedAgentResult<ContactExtractionOutput>;

/**
 * LangFuse-First Contact Extraction Agent
 *
 * Features:
 * - Required LangFuse observability (no fallbacks)
 * - LangFuse-managed prompts only
 * - Full tracing and performance monitoring
 * - WebData contact integration with detailed tracing
 * - Enhanced error handling with trace context
 * - Clean, modern API design
 */
export class ContactExtractionAgent {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    this.config = config;

    const model = createChatModel(config);

    const tools: DynamicStructuredTool[] = [
      ListDomainPagesTool,
      GetInformationAboutDomainTool,
      RetrieveFullPageTool,
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `{system_prompt}`],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const agent = createToolCallingAgent({
      llm: model,
      tools,
      prompt,
    });

    this.agent = new AgentExecutor({
      agent,
      maxIterations: config.maxIterations,
      tools,
    });
  }

  /**
   * Extract contacts from a website domain with full LangFuse observability
   *
   * @param domain - The domain to extract contacts from
   * @param options - Execution options including tracing context
   * @returns Enhanced contact extraction result with trace information
   * @throws Error if observability services are not available
   */
  async extractContacts(
    domain: string,
    options: AgentExecutionOptions
  ): Promise<ContactExtractionResult> {
    const startTime = Date.now();

    // Require observability services - fail fast if not available
    const observabilityServices = await getObservabilityServices();

    if (!observabilityServices.langfuseService.isAvailable()) {
      throw new Error(
        'LangFuse service is not available. Contact extraction requires observability services. ' +
          'Please check your LangFuse configuration.'
      );
    }

    // Create trace - required for all executions
    const traceResult = observabilityServices.langfuseService.createTrace(
      'contact-extraction',
      { domain },
      {
        agentName: 'ContactExtractionAgent',
        agentVersion: '2.0.0-langfuse-first',
        tenantId: options.tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
        ...options.metadata,
      }
    );

    const trace = traceResult.trace;
    if (!trace) {
      throw new Error('Failed to create LangFuse trace for contact extraction');
    }

    try {
      logger.info('Contact extraction started with LangFuse tracing', {
        domain,
        traceId: traceResult.traceId,
        tenantId: options.tenantId,
      });

      // Fetch webData contacts with tracing
      const webDataSpan = observabilityServices.langfuseService.createSpan(
        trace,
        'webdata-contacts-fetch',
        { domain }
      );

      logger.info('Fetching webData contacts for extraction', { domain });
      const webDataSummary = await fetchWebDataContacts(domain);
      const webDataContactsText = formatWebDataContactsForPrompt(webDataSummary);

      observabilityServices.langfuseService.updateSpan(
        webDataSpan,
        {
          contactCount: webDataSummary.contacts.length,
          hasContacts: webDataSummary.contacts.length > 0,
        },
        { success: true }
      );

      logger.info('WebData contacts fetched', {
        domain,
        contactCount: webDataSummary.contacts.length,
      });

      // Get prompt from LangFuse - required, no fallbacks
      const promptResult = await observabilityServices.promptService.getPromptWithVariables(
        'extract_contacts',
        {
          domain,
          webdata_contacts: webDataContactsText,
        },
        { cacheTtlSeconds: options.promptCacheTtl }
      );

      // Log prompt retrieval and webData results
      observabilityServices.langfuseService.logEvent(
        trace,
        'prompt-and-webdata-ready',
        {
          promptName: 'extract_contacts',
          domain,
          webDataContactCount: webDataSummary.contacts.length,
        },
        {
          cached: promptResult.cached,
          version: promptResult.version,
          source: promptResult.metadata?.source,
          hasWebDataContacts: webDataSummary.contacts.length > 0,
        }
      );

      // Execute the agent
      const result = await this.agent.invoke({
        system_prompt: promptResult.prompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.generateSummaryFromSteps(
          domain,
          result,
          promptResult.prompt,
          trace,
          observabilityServices
        );
      }

      // Parse AI results
      const aiParsedResult = this.parseWithSchema(finalResponse, domain);

      // Log AI parsing result
      observabilityServices.langfuseService.logEvent(
        trace,
        'ai-contacts-parsed',
        { domain },
        {
          aiContactCount: aiParsedResult.contacts.length,
          hasPriorityContact: aiParsedResult.priorityContactId !== null,
        }
      );

      // Merge AI contacts with webData contacts with tracing
      const mergeSpan = observabilityServices.langfuseService.createSpan(trace, 'contact-merge', {
        aiContactCount: aiParsedResult.contacts.length,
        webDataContactCount: webDataSummary.contacts.length,
      });

      const mergeResult = mergeContactSources(webDataSummary, aiParsedResult.contacts);
      const finalContacts = [...mergeResult.enrichedContacts, ...mergeResult.aiOnlyContacts];

      // Update priority contact index after merging
      let updatedPriorityContactId = aiParsedResult.priorityContactId;
      if (updatedPriorityContactId !== null && aiParsedResult.contacts.length > 0) {
        const originalPriorityContact = aiParsedResult.contacts[updatedPriorityContactId];
        if (originalPriorityContact) {
          const finalIndex = finalContacts.findIndex(
            (contact) =>
              contact.name.toLowerCase().trim() ===
              originalPriorityContact.name.toLowerCase().trim()
          );
          updatedPriorityContactId = finalIndex >= 0 ? finalIndex : null;
        }
      }

      // If no priority contact found from AI, try to find one from high-priority webData contacts
      if (updatedPriorityContactId === null) {
        const highPriorityIndex = finalContacts.findIndex((contact) => contact.isPriorityContact);
        if (highPriorityIndex >= 0 && finalContacts[highPriorityIndex]) {
          updatedPriorityContactId = highPriorityIndex;
          logger.info(
            `Set priority contact from webData: ${finalContacts[highPriorityIndex].name}`
          );
        }
      }

      const finalParsedResult: ContactExtractionOutput = {
        contacts: finalContacts,
        priorityContactId: updatedPriorityContactId,
        summary: `${aiParsedResult.summary} WebData contacts preserved: ${mergeResult.webDataContacts.length}, AI enrichments: ${mergeResult.enrichedContacts.length}, AI-only contacts: ${mergeResult.aiOnlyContacts.length}.`,
      };

      observabilityServices.langfuseService.updateSpan(
        mergeSpan,
        {
          webDataPreserved: mergeResult.webDataContacts.length,
          enrichedContacts: mergeResult.enrichedContacts.length,
          aiOnlyContacts: mergeResult.aiOnlyContacts.length,
          finalTotal: finalContacts.length,
          priorityContactIndex: updatedPriorityContactId,
        },
        { success: true }
      );

      const executionTimeMs = Date.now() - startTime;

      // Log completion
      observabilityServices.langfuseService.logEvent(
        trace,
        'contact-extraction-complete',
        {
          domain,
          totalIterations: result.intermediateSteps?.length ?? 0,
          executionTimeMs,
        },
        {
          success: true,
          finalContactCount: finalContacts.length,
          hasPriorityContact: updatedPriorityContactId !== null,
        }
      );

      // Update trace with final results
      observabilityServices.langfuseService.updateTrace(
        trace,
        {
          finalResponse: finalParsedResult,
          totalIterations: result.intermediateSteps?.length ?? 0,
          executionTimeMs,
        },
        {
          success: true,
          domain,
          totalContacts: finalContacts.length,
        }
      );

      logger.info('Contact extraction and merge completed', {
        domain,
        originalAI: aiParsedResult.contacts.length,
        originalWebData: webDataSummary.contacts.length,
        webDataPreserved: mergeResult.webDataContacts.length,
        enrichedContacts: mergeResult.enrichedContacts.length,
        aiOnlyContacts: mergeResult.aiOnlyContacts.length,
        finalTotal: finalContacts.length,
        priorityContactIndex: updatedPriorityContactId,
      });

      return {
        finalResponse: result.output || 'Contact extraction completed',
        finalResponseParsed: finalParsedResult,
        totalIterations: result.intermediateSteps?.length ?? 0,
        functionCalls: result.intermediateSteps,
        traceId: traceResult.traceId,
        metadata: {
          executionTimeMs,
          agentMetadata: {
            domain,
            webDataContactCount: webDataSummary.contacts.length,
            finalContactCount: finalContacts.length,
            promptVersion: promptResult.version,
            promptCached: promptResult.cached,
          },
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      logger.error('Contact extraction failed', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        traceId: traceResult.traceId,
      });

      // Log error to trace
      observabilityServices.langfuseService.logError(trace, error as Error, {
        phase: 'contact-extraction',
        domain,
        executionTimeMs,
      });

      observabilityServices.langfuseService.updateTrace(trace, null, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        domain,
        executionTimeMs,
      });

      // Enhanced error with trace context
      const enhancedError = new Error(
        `Contact extraction failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      (enhancedError as any).traceId = traceResult.traceId;
      (enhancedError as any).metadata = {
        executionTimeMs,
        domain,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            phase: 'contact-extraction',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      throw enhancedError;
    }
  }

  private async generateSummaryFromSteps(
    domain: string,
    result: any,
    systemPrompt: string,
    trace: any,
    observabilityServices: any
  ): Promise<string> {
    const span = observabilityServices.langfuseService.createSpan(trace, 'partial-steps-summary', {
      domain,
      intermediateStepsCount: result.intermediateSteps?.length ?? 0,
    });

    try {
      const structuredModel = createChatModel({
        model: this.config.model,
      }).withStructuredOutput(z.toJSONSchema(contactExtractionOutputSchema));

      const gatheredInfo = (result.intermediateSteps || [])
        .map((step: any) => {
          return `Tool: ${step.action?.tool || 'unknown'}\nResult: ${
            step.observation || 'No result'
          }\n`;
        })
        .join('\n---\n');

      const summaryPrompt = `
You are a contact extraction expert. Based on the research conducted below, extract all available contact information for ${domain}.

Research conducted so far:
${gatheredInfo}

${systemPrompt}

Even if the research is incomplete, extract all available contact information based on what was found.
Return your answer as valid JSON matching the provided schema.
      `;

      const summary = await structuredModel.invoke([
        {
          role: 'system',
          content: summaryPrompt,
        },
      ]);

      const summaryResult = getContentFromMessage(summary.content ?? summary);

      observabilityServices.langfuseService.updateSpan(
        span,
        { summaryLength: summaryResult.length },
        { success: true }
      );

      return summaryResult;
    } catch (error) {
      observabilityServices.langfuseService.updateSpan(span, null, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private parseWithSchema(content: string, domain: string): ContactExtractionOutput {
    try {
      // Remove markdown code fencing and whitespace if present
      const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
      return contactExtractionOutputSchema.parse(JSON.parse(jsonText));
    } catch (error) {
      logger.error('Contact extraction JSON parsing failed', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        contentPreview: content.substring(0, 200),
      });

      throw new Error(
        `Failed to parse contact extraction results for ${domain}: ${
          error instanceof Error ? error.message : 'Unknown parsing error'
        }`
      );
    }
  }
}
