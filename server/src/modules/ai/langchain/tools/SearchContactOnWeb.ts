import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const SearchContactOnWebTool = new DynamicStructuredTool({
  name: 'SearchContactOnWeb',
  description:
    'Search for contact information on the web, example would be "{contact_name} {contact_city} {contact_website} email"',
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
