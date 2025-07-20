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
        'Downloads the HTML from any page URL, cleans and converts it to readable Markdown. Input the exact URL (e.g., https://acme.com/about). The output is the full text of the page, formatted and ready for processing or embedding. When to use: You need the actual page content as Markdown, either to review, or debug.',
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

      const fullPage: RetrieveFullPageToolResponse = await originalTool(url.cleanWebsiteUrl());

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
