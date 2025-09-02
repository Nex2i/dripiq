import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promptHelper } from '@/prompts/prompt.helper';
import { logger } from '@/libs/logger';
import extractContactsPrompt from '@/prompts/extractContacts.prompt';
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

export type ContactExtractionResult = {
  finalResponse: string;
  finalResponseParsed: ContactExtractionOutput;
  totalIterations: number;
  functionCalls: any[];
};

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

  async extractContacts(domain: string): Promise<ContactExtractionResult> {
    // First, fetch webData contacts to include in the prompt
    logger.info('Fetching webData contacts for extraction', { domain });
    const webDataSummary = await fetchWebDataContacts(domain);
    logger.info('WebData contacts fetched', { domain, webDataSummary });
    const webDataContactsText = formatWebDataContactsForPrompt(webDataSummary);

    const systemPrompt = promptHelper.injectInputVariables(extractContactsPrompt, {
      domain,
      webdata_contacts: webDataContactsText,
      output_schema: JSON.stringify(z.toJSONSchema(contactExtractionOutputSchema), null, 2),
    });

    try {
      const result = await this.agent.invoke({
        system_prompt: systemPrompt,
      });

      let finalResponse = getContentFromMessage(result.output);

      if (!finalResponse && result.intermediateSteps && result.intermediateSteps.length > 0) {
        finalResponse = await this.generateSummaryFromSteps(domain, result, systemPrompt);
      }

      const aiParsedResult = parseWithSchema(finalResponse, domain);

      // Merge AI contacts with webData contacts - webData first approach
      const mergeResult = mergeContactSources(webDataSummary, aiParsedResult.contacts);

      // Combine contacts: enriched webData contacts first, then AI-only contacts
      const finalContacts = [...mergeResult.enrichedContacts, ...mergeResult.aiOnlyContacts];

      // Update priority contact index after merging
      let updatedPriorityContactId = aiParsedResult.priorityContactId;
      if (updatedPriorityContactId !== null && aiParsedResult.contacts.length > 0) {
        const originalPriorityContact = aiParsedResult.contacts[updatedPriorityContactId];
        if (originalPriorityContact) {
          // Find the priority contact in the final list
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
      };
    } catch (error) {
      logger.error('Contact extraction failed:', error);

      // Return fallback result with webData contacts if available
      const fallbackResult = getFallbackResultWithWebData(domain, error, webDataSummary);
      return {
        finalResponse: `Contact extraction failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        finalResponseParsed: fallbackResult,
        totalIterations: 0,
        functionCalls: [],
      };
    }
  }

  private async generateSummaryFromSteps(
    domain: string,
    result: any,
    systemPrompt: string
  ): Promise<string> {
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
    return getContentFromMessage(summary.content ?? summary);
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
