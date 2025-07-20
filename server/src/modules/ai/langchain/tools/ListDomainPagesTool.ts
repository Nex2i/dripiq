import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, siteEmbeddingDomains, siteEmbeddings } from '@/db';

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
      const domainId = await db
        .select({ id: siteEmbeddingDomains.id })
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, domain));

      if (!domainId.length) {
        return JSON.stringify({
          success: true,
          domain: domain,
          message: 'No pages found for this domain',
          pages: [],
        });
      }

      const pages = await db
        .selectDistinct({ url: siteEmbeddings.url })
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.domainId, domainId[0]!.id));

      const pageUrls = pages.map((page) => page.url);

      return JSON.stringify({
        success: true,
        domain: domain,
        totalPages: pageUrls.length,
        pages: pageUrls,
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
