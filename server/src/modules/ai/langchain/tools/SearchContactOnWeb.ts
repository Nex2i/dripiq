import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const SearchContactOnWebTool = new DynamicStructuredTool({
  name: 'SearchContactOnWeb',
  description: 'Search for contact information on the web',
  schema: z.object({
    url: z.string().describe('The URL to search for contact information'),
  }),
  func: async (input: { url: string }) => {
    const { url } = input;

    const response = await fetch(url);
    const data = await response.json();

    return data;
  },
});
