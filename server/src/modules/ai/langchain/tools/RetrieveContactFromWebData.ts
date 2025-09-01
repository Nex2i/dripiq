import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getWebDataService } from '@/libs/webData';

const webDataService = getWebDataService();

export const RetrieveContactFromWebDataTool = new DynamicStructuredTool({
  name: 'RetrieveContactFromWebDataTool',
  description: 'Retrieve contact information from WebData',
  schema: z.object({
    domain: z.string().describe('The domain of the company to retrieve contact information from'),
  }),
  func: async (input: { domain: string }) => {
    const { domain } = input;

    const webData = await webDataService.getEmployeesByCompanyDomain(domain);

    // Clean the webData to not use unnecessary tokens

    return webData;
  },
});
