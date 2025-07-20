import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  GetInformationAboutDomainTool as originalTool,
  DomainInformation,
} from '../../tools/GetInformationAboutDomain';

const GetInformationAboutDomainSchema = z.object({
  domain: z.string().describe('The domain to get information about'),
  query_text: z.string().optional().describe('Specific query about the domain'),
  top_k: z.number().optional().default(5).describe('Number of top results to return'),
});

export class GetInformationAboutDomainTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: 'GetInformationAboutDomainTool',
      description: 'Get information about a domain by searching through embedded content',
      schema: GetInformationAboutDomainSchema,
      func: async (args: z.infer<typeof GetInformationAboutDomainSchema>): Promise<string> => {
        try {
          const { domain, query_text, top_k } = args;

          if (!domain) {
            throw new Error('Domain is required');
          }

          const domainInfo: DomainInformation = await originalTool(domain, query_text, top_k);

          return JSON.stringify(domainInfo);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to get domain information: ${errorMessage}`);
        }
      },
    });
  }
}