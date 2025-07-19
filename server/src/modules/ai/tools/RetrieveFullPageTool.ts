import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import {
  RetrieveFullPageTool as originalTool,
  RetrieveFullPageToolResponse,
} from './RetrieveFullPage';

export class RetrieveFullPageTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'RetrieveFullPageTool',
      description:
        'Fetches the HTML content from a given URL and converts it to clean Markdown format.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full URL to fetch and convert (e.g., https://example.com/about).',
          },
        },
        required: ['url'],
      },
    };
  }

  async execute(args: any): Promise<IToolResult> {
    try {
      const { url } = args;

      if (!url) {
        return {
          success: false,
          error: 'URL is required',
        };
      }

      const fullPage: RetrieveFullPageToolResponse = await originalTool(url);

      return {
        success: true,
        data: fullPage,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
