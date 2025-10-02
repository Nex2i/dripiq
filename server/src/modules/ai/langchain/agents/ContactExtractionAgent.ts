import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from '@/libs/logger';
import { LangChainConfig } from '../config/langchain.config';
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
} from '../../schemas/contactExtraction/contactExtractionSchema';
import { DefaultAgentExecuter } from './AgentExecuter';

export type ContactExtractionResult = {
  finalResponseParsed: ContactExtractionOutput;
  totalIterations: number;
  functionCalls: any[];
};

export class ContactExtractionAgent {
  private config: LangChainConfig;
  private tools: DynamicStructuredTool[];

  constructor(config: LangChainConfig) {
    this.config = config;

    this.tools = [ListDomainPagesTool, GetInformationAboutDomainTool, RetrieveFullPageTool];
  }

  async execute(
    domain: string,
    tenantId: string,
    metadata: Record<string, any>
  ): Promise<ContactExtractionResult> {
    const startTime = Date.now();
    try {
      logger.info('Fetching webData contacts for extraction', { domain });
      const webDataSummary = await fetchWebDataContacts(domain);
      logger.info('WebData contacts fetched', { domain, webDataSummary });
      const webDataContactsText = formatWebDataContactsForPrompt(webDataSummary);

      const variables = {
        domain,
        webdata_contacts: webDataContactsText,
      };

      const agentResult = await DefaultAgentExecuter<ContactExtractionOutput>({
        promptName: 'extract_contacts',
        tenantId,
        variables,
        config: this.config,
        outputSchema: contactExtractionOutputSchema,
        tools: this.tools,
        metadata,
        tags: ['extract_contacts'],
      });

      const mergeResult = mergeContactSources(webDataSummary, agentResult.output.contacts);

      const finalContacts = [...mergeResult.enrichedContacts, ...mergeResult.aiOnlyContacts];

      // Update priority contact index after merging
      let updatedPriorityContactId = agentResult.output.priorityContactId;
      if (updatedPriorityContactId !== null && agentResult.output.contacts.length > 0) {
        const originalPriorityContact = agentResult.output.contacts[updatedPriorityContactId];
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
        summary: `${agentResult.output.summary} WebData contacts preserved: ${mergeResult.webDataContacts.length}, AI enrichments: ${mergeResult.enrichedContacts.length}, AI-only contacts: ${mergeResult.aiOnlyContacts.length}.`,
      };

      const endTime = Date.now();

      logger.info('Contact extraction and merge completed', {
        domain,
        originalAI: agentResult.output.contacts.length,
        originalWebData: webDataSummary.contacts.length,
        webDataPreserved: mergeResult.webDataContacts.length,
        enrichedContacts: mergeResult.enrichedContacts.length,
        aiOnlyContacts: mergeResult.aiOnlyContacts.length,
        finalTotal: finalContacts.length,
        priorityContactIndex: updatedPriorityContactId,
        duration: endTime - startTime,
      });

      return {
        finalResponseParsed: finalParsedResult,
        totalIterations: agentResult.intermediateSteps?.length ?? 0,
        functionCalls: agentResult.intermediateSteps,
      };
    } catch (error) {
      logger.error('Contact extraction failed:', error);
      throw new Error(
        `Contact extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
