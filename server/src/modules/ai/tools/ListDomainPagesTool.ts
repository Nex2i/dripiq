import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import {
  ListDomainPagesTool as originalTool,
  ListDomainPagesToolResponse,
} from './ListDomainPages';

export class ListDomainPagesTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'ListDomainPagesTool',
      description: 'List all pages found for a specific domain',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to list pages for',
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
