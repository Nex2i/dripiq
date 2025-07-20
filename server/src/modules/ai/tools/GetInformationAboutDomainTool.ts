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
        "Returns the most relevant pieces of content from a website by searching its embedded Markdown using vector similarity. Specify the domain (e.g., acme.com) and describe what you want to find in plain English. Results include the top N text chunks most related to your query. When to use: You want direct answers, facts, or summaries from a site's content (not just metadata or page lists).",
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The root domain to search or list pages for. (e.g., acme.com)',
          },
          query_text: {
            type: 'string',
            description:
              'The natural language query used to find semantically similar content associated with the domain. Should be a well-formed sentence or paragraph describing what to look for.',
          },
        },
        required: ['domain', 'query_text'],
      },
    };
  }

  async execute(args: any): Promise<IToolResult> {
    try {
      const { domain, query_text } = args;

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

      const domainInfo: DomainInformation = await originalTool(domain, query_text);

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
