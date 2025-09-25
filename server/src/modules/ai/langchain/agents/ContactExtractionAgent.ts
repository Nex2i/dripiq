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
  WebDataContactSummary,
  convertWebDataToExtractedContact,
} from '../../webDataContactHelper';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import contactExtractionOutputSchema, {
  ContactExtractionOutput,
} from '../../schemas/contactExtractionSchema';
import { getContentFromMessage } from '../utils/messageUtils';
import { BaseObservableAgent } from '../../observability/base-agent';
import { 
  AgentExecutionOptions, 
  AgentExecutionResult, 
  AgentTracingContext,
  PromptInjectionContext,
  AgentError,
  AgentErrorType 
} from '../../observability/types';
import { langfuseService } from '../../observability/langfuse.service';

export type ContactExtractionResult = AgentExecutionResult<ContactExtractionOutput>;

export interface ContactExtractionInput {
  domain: string;
}

export class ContactExtractionAgent extends BaseObservableAgent<ContactExtractionInput, ContactExtractionOutput> {
  private agent: AgentExecutor;
  private config: LangChainConfig;

  constructor(config: LangChainConfig) {
    super();
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

  protected getAgentName(): string {
    return 'ContactExtractionAgent';
  }

  protected getAgentVersion(): string {
    return '2.0.0';
  }

  protected getPromptName(): string {
    return 'extract_contacts';
  }

  protected getAgentDescription(): string {
    return 'Extracts contact information from websites, merging with webData contacts for comprehensive results';
  }

  protected preparePromptContext(input: ContactExtractionInput): PromptInjectionContext {
    return {
      domain: input.domain,
      variables: {
        domain: input.domain,
        // webdata_contacts and output_schema will be injected in executeCore
      },
    };
  }

  protected async executeCore(
    input: ContactExtractionInput,
    promptContent: string,
    context: AgentTracingContext
  ): Promise<{
    finalResponse: string;
    finalResponseParsed: ContactExtractionOutput;
    totalIterations: number;
    functionCalls: any[];
  }> {
    // Create span for webData fetching
    const webDataSpan = context ? langfuseService.createSpan(context.trace, {
      name: 'webdata_contacts_fetch',
      metadata: {
        domain: input.domain,
      },
    }) : null;

    let webDataSummary: WebDataContactSummary;
    try {
      // Fetch webData contacts first
      logger.info('Fetching webData contacts for extraction', { domain: input.domain });
      webDataSummary = await fetchWebDataContacts(input.domain);
      
      if (webDataSpan) {
        langfuseService.updateElement(webDataSpan, {
          output: {
            success: true,
            contactCount: webDataSummary.contacts.length,
            hasHighPriority: webDataSummary.contacts.some(c => c.priority === 'high'),
          },
        });
        langfuseService.endElement(webDataSpan);
      }

      logger.info('WebData contacts fetched', { domain: input.domain, contactCount: webDataSummary.contacts.length });
    } catch (error) {
      if (webDataSpan) {
        langfuseService.updateElement(webDataSpan, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(webDataSpan);
      }

      // Continue with empty webData if fetching fails
      webDataSummary = { contacts: [], totalFound: 0, highPriorityCount: 0 };
      logger.warn('WebData contacts fetch failed, continuing with empty data', { 
        domain: input.domain, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // Format webData contacts for prompt injection
    const webDataContactsText = formatWebDataContactsForPrompt(webDataSummary);
    
    // Inject webData contacts into the prompt
    const finalPrompt = promptContent
      .replace('{{webdata_contacts}}', webDataContactsText)
      .replace('{{output_schema}}', JSON.stringify(z.toJSONSchema(contactExtractionOutputSchema), null, 2));

    // Create generation for LLM tracking
    const generation = context ? langfuseService.createGeneration(context.trace, {
      name: 'contact_extraction_generation',
      model: this.config.model,
      input: {
        domain: input.domain,
        promptLength: finalPrompt.length,
        webDataContactCount: webDataSummary.contacts.length,
      },
    }) : null;

    try {
      const result = await this.agent.invoke({
        system_prompt: finalPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.generateSummaryFromSteps(input.domain, result, finalPrompt, context);
      }

      const aiParsedResult = parseWithSchema(finalResponse, input.domain);

      // Create span for contact merging
      const mergeSpan = context ? langfuseService.createSpan(context.trace, {
        name: 'contact_merge_process',
        metadata: {
          aiContactCount: aiParsedResult.contacts.length,
          webDataContactCount: webDataSummary.contacts.length,
        },
      }) : null;

      try {
        // Merge AI contacts with webData contacts
        const mergeResult = mergeContactSources(webDataSummary, aiParsedResult.contacts);
        const finalContacts = [...mergeResult.enrichedContacts, ...mergeResult.aiOnlyContacts];

        // Update priority contact index after merging
        let updatedPriorityContactId = this.updatePriorityContactId(
          aiParsedResult, finalContacts
        );

        const finalParsedResult: ContactExtractionOutput = {
          contacts: finalContacts,
          priorityContactId: updatedPriorityContactId,
          summary: `${aiParsedResult.summary} WebData contacts preserved: ${mergeResult.webDataContacts.length}, AI enrichments: ${mergeResult.enrichedContacts.length}, AI-only contacts: ${mergeResult.aiOnlyContacts.length}.`,
        };

        if (mergeSpan) {
          langfuseService.updateElement(mergeSpan, {
            output: {
              success: true,
              finalContactCount: finalContacts.length,
              enrichedCount: mergeResult.enrichedContacts.length,
              aiOnlyCount: mergeResult.aiOnlyContacts.length,
              priorityContactId: updatedPriorityContactId,
            },
          });
          langfuseService.endElement(mergeSpan);
        }

        // Update generation with success
        if (generation) {
          langfuseService.updateElement(generation, {
            output: {
              success: true,
              responseLength: finalResponse.length,
              finalContactCount: finalContacts.length,
              iterations: result.intermediateSteps?.length ?? 0,
            },
          });
          langfuseService.endElement(generation);
        }

        // Track function calls as events
        if (context && result.intermediateSteps) {
          this.trackFunctionCalls(context, result.intermediateSteps);
        }

        logger.info('Contact extraction and merge completed', {
          domain: input.domain,
          originalAI: aiParsedResult.contacts.length,
          originalWebData: webDataSummary.contacts.length,
          finalTotal: finalContacts.length,
          priorityContactIndex: updatedPriorityContactId,
        });

        return {
          finalResponse: result.output || 'Contact extraction completed',
          finalResponseParsed: finalParsedResult,
          totalIterations: result.intermediateSteps?.length ?? 0,
          functionCalls: result.intermediateSteps ?? [],
        };

      } catch (mergeError) {
        if (mergeSpan) {
          langfuseService.updateElement(mergeSpan, {
            output: { 
              error: mergeError instanceof Error ? mergeError.message : 'Unknown error',
              success: false 
            },
            level: 'ERROR',
          });
          langfuseService.endElement(mergeSpan);
        }
        throw mergeError;
      }

    } catch (error) {
      // Update generation with error
      if (generation) {
        langfuseService.updateElement(generation, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(generation);
      }

      logger.error('Contact extraction failed', {
        domain: input.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return fallback with webData if available
      const fallbackResult = getFallbackResultWithWebData(input.domain, error, webDataSummary);
      
      return {
        finalResponse: `Contact extraction failed for ${input.domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        finalResponseParsed: fallbackResult,
        totalIterations: 0,
        functionCalls: [],
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async extractContacts(domain: string, options?: AgentExecutionOptions): Promise<ContactExtractionResult> {
    return this.execute({ domain }, options);
  }

  private updatePriorityContactId(
    aiParsedResult: ContactExtractionOutput,
    finalContacts: any[]
  ): number | null {
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

    return updatedPriorityContactId;
  }

  private async generateSummaryFromSteps(
    domain: string,
    result: any,
    systemPrompt: string,
    context: AgentTracingContext | null
  ): Promise<string> {
    const summarySpan = context ? langfuseService.createSpan(context.trace, {
      name: 'contact_extraction_summary',
      metadata: {
        domain,
        stepCount: result.intermediateSteps?.length || 0,
      },
    }) : null;

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

      if (summarySpan) {
        langfuseService.updateElement(summarySpan, {
          output: {
            success: true,
            summaryLength: summaryResult.length,
          },
        });
        langfuseService.endElement(summarySpan);
      }

      return summaryResult;
    } catch (error) {
      if (summarySpan) {
        langfuseService.updateElement(summarySpan, {
          output: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false 
          },
          level: 'ERROR',
        });
        langfuseService.endElement(summarySpan);
      }

      throw error;
    }
  }

  private trackFunctionCalls(context: AgentTracingContext, intermediateSteps: any[]): void {
    intermediateSteps.forEach((step, index) => {
      const toolName = step.action?.tool || 'unknown_tool';
      const toolInput = step.action?.toolInput || {};
      const observation = step.observation || 'No result';

      langfuseService.createEvent(context.trace, {
        name: `tool_call_${toolName}`,
        input: {
          step: index + 1,
          tool: toolName,
          input: toolInput,
        },
        output: {
          observation: observation,
          success: !!observation,
        },
        metadata: {
          toolName,
          stepIndex: index,
          hasResult: !!observation,
        },
      });
    });
  }
}

// -- Helpers --
function parseWithSchema(content: string, domain: string): ContactExtractionOutput {
  try {
    // Remove markdown code fencing and whitespace if present
    const jsonText = content.replace(/^```(?:json)?|```$/g, '').trim();
    return contactExtractionOutputSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    logger.warn('Contact extraction parsing failed, returning fallback.', error);
    return getFallbackResult(domain, error);
  }
}

function getFallbackResult(domain: string, error: unknown): ContactExtractionOutput {
  return {
    contacts: [],
    priorityContactId: null,
    summary: `Unable to extract contacts from ${domain} due to an error: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`,
  };
}

function getFallbackResultWithWebData(
  domain: string,
  error: unknown,
  webDataSummary: WebDataContactSummary
): ContactExtractionOutput {
  // If we have webData contacts, use them as fallback
  if (webDataSummary.contacts.length > 0) {
    const webDataAsExtracted = webDataSummary.contacts.map(convertWebDataToExtractedContact);
    const priorityIndex = webDataAsExtracted.findIndex((contact) => contact.isPriorityContact);

    return {
      contacts: webDataAsExtracted,
      priorityContactId: priorityIndex >= 0 ? priorityIndex : null,
      summary: `AI extraction failed for ${domain}, but ${webDataSummary.contacts.length} webData contacts were preserved. Error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }

  // No webData contacts available, return empty result
  return getFallbackResult(domain, error);
}
