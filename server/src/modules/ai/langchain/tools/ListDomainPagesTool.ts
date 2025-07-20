import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  ListDomainPagesTool as originalTool,
  ListDomainPagesToolResponse,
} from '../../tools/ListDomainPages';

const ListDomainPagesSchema = z.object({
  domain: z.string().describe('The domain to list pages for'),
});

export class ListDomainPagesTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: 'ListDomainPagesTool',
      description: 'List all pages found for a specific domain',
      schema: ListDomainPagesSchema,
      func: async (args: z.infer<typeof ListDomainPagesSchema>): Promise<string> => {
        try {
          const { domain } = args;

          if (!domain) {
            throw new Error('Domain is required');
          }

          const response: ListDomainPagesToolResponse = await originalTool(domain);

          return JSON.stringify(response);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to list domain pages: ${errorMessage}`);
        }
      },
    });
  }
}