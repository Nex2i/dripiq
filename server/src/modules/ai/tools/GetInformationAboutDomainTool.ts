import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import {
  GetInformationAboutDomainTool as originalTool,
  DomainInformation,
} from './GetInformationAboutDomain';

export class GetInformationAboutDomainTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'GetInformationAboutDomainTool',
      description: 'Get information about a domain by searching through embedded content',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to get information about',
          },
          query_text: {
            type: 'string',
            description: 'Specific query about the domain',
          },
          top_k: {
            type: 'number',
            description: 'Number of top results to return',
            default: 5,
          },
        },
        required: ['domain'],
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
