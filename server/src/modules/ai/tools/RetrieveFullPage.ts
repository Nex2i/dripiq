import { eq } from 'drizzle-orm';
import { Tool } from 'openai/resources/responses/responses';
import { db, siteEmbeddings } from '@/db';

export interface RetrieveFullPageToolResponse {
  domain: string;
  content: string;
}

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
