import { eq } from 'drizzle-orm';
import { db, siteEmbeddingDomains, siteEmbeddings } from '@/db';
import { Tool } from 'openai/resources/responses/responses';

export const listDomainPagesTool: Tool = {
  type: 'function' as const,
  name: 'ListDomainPagesTool',
  description: 'Retrieve a list of all the pages on a domain that have been vectorized',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'The domain to list the pages of',
      },
    },
    required: ['domain'],
  },
  strict: null,
};

export interface ListDomainPagesToolResponse {
  domain: string;
  pages: Array<string>;
}

export const ListDomainPagesTool = async (domain: string): Promise<ListDomainPagesToolResponse> => {
  // Query that gets all unique page Urls for a given domain
  const domainId = await db
    .select({ id: siteEmbeddingDomains.id })
    .from(siteEmbeddingDomains)
    .where(eq(siteEmbeddingDomains.domain, domain));

  if (!domainId.length) {
    return {
      domain: domain,
      pages: [],
    };
  }

  const pages = await db
    .select({
      url: siteEmbeddings.url,
    })
    .from(siteEmbeddings)
    .where(eq(siteEmbeddings.domainId, domainId[0]!.id));

  return {
    domain: domain,
    pages: pages.map((page) => page.url),
  };
};
