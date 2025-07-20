import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, siteEmbeddingDomains, siteEmbeddings } from '@/db';

export const ListDomainPagesTool = new DynamicTool({
  name: 'ListDomainPagesTool',
  description: 'Lists all available pages/URLs for a given domain. Use this format: {"domain": "example.com"}. Provide a domain to get a list of all pages that have been crawled and are available for analysis.',
  func: async (input: string) => {
    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(input);
      } catch {
        // If input is not JSON, treat as direct domain
        parsedInput = { domain: input };
      }

      const { domain } = parsedInput;
      
      if (!domain) {
        return JSON.stringify({ error: 'domain field is required' });
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
        .selectDistinct({ url: siteEmbeddings.url })
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.domainId, domainId[0]!.id));

      const pageUrls = pages.map((page) => page.url);

      return JSON.stringify({
        domain: domain,
        pages: pageUrls,
      });
    } catch (error) {
      let inputDomain = 'unknown';
      try {
        const parsed = JSON.parse(input);
        inputDomain = parsed.domain || input;
      } catch {
        inputDomain = input;
      }
      
      return JSON.stringify({
        domain: inputDomain,
        error: `Failed to list pages for domain. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        pages: [],
      });
    }
  }
});