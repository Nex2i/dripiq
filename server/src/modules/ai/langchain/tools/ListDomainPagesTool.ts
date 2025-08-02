import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { siteEmbeddingDomainRepository, siteEmbeddingRepository } from '@/repositories';

export const ListDomainPagesTool = new DynamicStructuredTool({
  name: 'ListDomainPages',
  description:
    'Lists all available pages/URLs for a given domain. Returns all pages that have been crawled and are available for analysis.',
  schema: z.object({
    domain: z
      .string()
      .describe('The domain name to list pages for (e.g., "example.com" - without protocol)'),
  }),
  func: async (input: { domain: string }) => {
    const { domain } = input;

    try {
      if (!domain) {
        return JSON.stringify({
          success: false,
          error: 'Domain is required',
          domain: '',
          pages: [],
        });
      }

      // Query that gets all unique page URLs for a given domain
      const domainRecord = await siteEmbeddingDomainRepository.findByDomain(domain);

      if (!domainRecord) {
        return JSON.stringify({
          success: true,
          domain: domain,
          message: 'No pages found for this domain',
          pages: [],
        });
      }

      const pages = await siteEmbeddingRepository.getUniquePageUrls(domainRecord.id);

      return JSON.stringify({
        success: true,
        domain: domain,
        totalPages: pages.length,
        pages: pages,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        domain: domain,
        error: `Failed to list pages for domain: ${error instanceof Error ? error.message : 'Unknown error'}`,
        pages: [],
      });
    }
  },
});
