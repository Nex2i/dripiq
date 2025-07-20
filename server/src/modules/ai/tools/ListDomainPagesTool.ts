import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import {
  ListDomainPagesTool as originalTool,
  ListDomainPagesToolResponse,
} from './ListDomainPages';

export class ListDomainPagesTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'ListDomainPagesTool',
      description:
        'Lists all URLs on a website that have been scraped and embedded for semantic search. Provide the domain (e.g., acme.com). The tool returns every available page, ready for detailed querying. When to use: You want to see what parts of a site are available for semantic search, or need URLs for further querying.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The root domain to search or list pages for. (e.g., acme.com)',
          },
        },
        required: ['domain'],
      },
    };
  }

  async execute(args: any): Promise<IToolResult> {
    try {
      const { domain } = args;

      if (!domain) {
        return {
          success: false,
          error: 'Domain is required',
        };
      }

      const pages: ListDomainPagesToolResponse = await originalTool(domain);

      return {
        success: true,
        data: pages,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
