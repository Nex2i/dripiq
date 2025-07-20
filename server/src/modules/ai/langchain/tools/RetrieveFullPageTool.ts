import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  RetrieveFullPageTool as originalTool,
  RetrieveFullPageToolResponse,
} from '../../tools/RetrieveFullPage';

const RetrieveFullPageSchema = z.object({
  url: z.string().describe('The full URL to retrieve the page from'),
});

export class RetrieveFullPageTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: 'RetrieveFullPageTool',
      description: 'Retrieve full content from a specific page on a domain',
      schema: RetrieveFullPageSchema,
      func: async (args: z.infer<typeof RetrieveFullPageSchema>): Promise<string> => {
        try {
          const { url } = args;

          if (!url) {
            throw new Error('URL is required');
          }

          const response: RetrieveFullPageToolResponse = await originalTool(url);

          return JSON.stringify(response);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to retrieve page content: ${errorMessage}`);
        }
      },
    });
  }
}