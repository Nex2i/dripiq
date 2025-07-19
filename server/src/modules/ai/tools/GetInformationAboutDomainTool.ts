import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import {
  GetInformationAboutDomainTool as originalTool,
  DomainInformation,
} from './GetInformationAboutDomain';

export class GetInformationAboutDomainTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'GetInformationAboutDomainTool',
      description:
        'Retrieves semantically relevant information about a given domain (e.g., acme.com) using vector similarity search. Searches an internal pgvector database of scraped and embedded web content for the most relevant matches to a given query.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description:
              'The website domain to search for (e.g., example.com). This must be a valid domain present in the vector database.',
          },
          query_text: {
            type: 'string',
            description:
              'The natural language query used to find semantically similar content associated with the domain. Should be a well-formed sentence or paragraph describing what to look for.',
          },
          top_k: {
            type: 'number',
            description: 'The number of top similar content chunks to return. Defaults to 10.',
            default: 10,
          },
        },
        required: ['domain', 'query_text', 'top_k'],
      },
    };
  }

  async execute(args: any): Promise<IToolResult> {
    try {
      const { domain, query_text, top_k } = args;

      if (!domain) {
        return {
          success: false,
          error: 'Domain is required',
        };
      }

      if (!query_text) {
        return {
          success: false,
          error: 'Query text is required',
        };
      }

      if (!top_k) {
        return {
          success: false,
          error: 'Top K is required',
        };
      }

      const domainInfo: DomainInformation = await originalTool(domain, query_text, top_k);

      return {
        success: true,
        data: domainInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
