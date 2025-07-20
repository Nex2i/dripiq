import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, siteEmbeddingDomains, siteEmbeddings } from '@/db';

const schema = z.object({
  domain: z.string().describe('The domain to list pages for (e.g., example.com)'),
});

export class ListDomainPagesTool extends DynamicTool {
  constructor() {
    super({
      name: 'ListDomainPagesTool',
      description: 'Lists all available pages/URLs for a given domain. Provide a domain to get a list of all pages that have been crawled and are available for analysis.',
      func: async (input: string) => {
        try {
          let domain: string;
          
          try {
            const parsedInput = JSON.parse(input);
            domain = parsedInput.domain;
          } catch {
            // If input is not JSON, treat as direct domain
            domain = input;
          }

          // Query that gets all unique page URLs for a given domain
          const domainId = await db
            .select({ id: siteEmbeddingDomains.id })
            .from(siteEmbeddingDomains)
            .where(eq(siteEmbeddingDomains.domain, domain));

          if (!domainId.length) {
            return JSON.stringify({
              domain: domain,
              pages: [],
            });
          }

          const pages = await db
            .select({
              url: siteEmbeddings.url,
            })
            .from(siteEmbeddings)
            .where(eq(siteEmbeddings.domainId, domainId[0]!.id));

          const uniquePages = [...new Set(pages.map((page) => page.url))];

          return JSON.stringify({
            domain: domain,
            pages: uniquePages,
          });
        } catch (error) {
          return JSON.stringify({
            domain: input,
            error: `Failed to list pages for domain: ${input}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            pages: [],
          });
        }
      },
    });
  }
}