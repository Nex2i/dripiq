import { db, siteEmbeddings } from '@/db';
import { eq } from 'drizzle-orm';
import { Tool } from 'openai/resources/responses/responses';

export interface RetrieveFullPageToolResponse {
  domain: string;
  content: string;
}

export const retrieveFullPageTool: Tool = {
  type: 'function',
  name: 'RetrieveFullPageTool',
  description:
    'Fetches the HTML content from a given URL and converts it to clean Markdown format.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to fetch and convert (e.g., https://example.com/about)',
      },
    },
    required: ['url'],
  },
  strict: null,
};

export const RetrieveFullPageTool = async (url: string): Promise<RetrieveFullPageToolResponse> => {
  const embeddings = await db
    .select({ id: siteEmbeddings.id, content: siteEmbeddings.content })
    .from(siteEmbeddings)
    .where(eq(siteEmbeddings.url, url));

  const fullMarkdown = embeddings.map((embedding) => embedding.content).join('\n');

  return {
    domain: url,
    content: fullMarkdown,
  };
};
