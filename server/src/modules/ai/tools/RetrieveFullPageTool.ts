import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import {
  RetrieveFullPageTool as originalTool,
  RetrieveFullPageToolResponse,
} from './RetrieveFullPage';

export class RetrieveFullPageTool implements ITool {
  getDefinition(): IToolDefinition {
    return {
      name: 'RetrieveFullPageTool',
      description: 'Retrieve the full content of a specific page',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the page to retrieve',
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
