import { Tool } from 'openai/resources/responses/responses';
import { sql, eq, desc } from 'drizzle-orm';
import db from '@/libs/drizzleClient';
import { siteEmbeddings, siteEmbeddingDomains } from '@/db/schema';
import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';

export interface DomainInformation {
  domain: string;
  error?: string;
  searchResults?: Array<{
    id: string;
    url: string;
    title?: string;
    content: string;
    contentSummary?: string;
    similarity: number;
    chunkIndex?: number;
    metadata?: any;
  }>;
}

export const GetInformationAboutDomainTool = async (
  domain: string,
  queryText?: string,
  topK: number = 10
): Promise<DomainInformation> => {
  try {
    const cleanDomain = domain.getDomain();

    const domainRecord = await db
      .select()
      .from(siteEmbeddingDomains)
      .where(eq(siteEmbeddingDomains.domain, cleanDomain))
      .limit(1);

    if (!domainRecord.length || !domainRecord[0]) {
      return {
        domain: cleanDomain,
        error: `No embedding data found for domain: ${cleanDomain}`,
      };
    }

    const domainId = domainRecord[0].id;

    if (!queryText) {
      const recentContent = await db
        .select({
          id: siteEmbeddings.id,
          url: siteEmbeddings.url,
          title: siteEmbeddings.title,
          content: siteEmbeddings.content,
          contentSummary: siteEmbeddings.contentSummary,
          chunkIndex: siteEmbeddings.chunkIndex,
          metadata: siteEmbeddings.metadata,
        })
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.domainId, domainId))
        .orderBy(desc(siteEmbeddings.createdAt))
        .limit(topK);

      return {
        domain: cleanDomain,
        searchResults: recentContent.map((item) => ({
          id: item.id,
          url: item.url,
          title: item.title ?? undefined,
          content: item.content,
          contentSummary: item.contentSummary ?? undefined,
          chunkIndex: item.chunkIndex ?? undefined,
          metadata: item.metadata,
          similarity: 0,
        })),
      };
    }

    const queryEmbeddingResponse = await openAiEmbeddingClient.createEmbedding(queryText);
    const queryEmbedding = queryEmbeddingResponse.data[0]?.embedding;

    if (!queryEmbedding) {
      return {
        domain: cleanDomain,
        error: 'Failed to generate embedding for query text',
      };
    }

    const similarityResults = await db.execute(sql`
      SELECT 
        ${siteEmbeddings.id},
        ${siteEmbeddings.url},
        ${siteEmbeddings.title},
        ${siteEmbeddings.content},
        ${siteEmbeddings.contentSummary},
        ${siteEmbeddings.chunkIndex},
        ${siteEmbeddings.metadata},
        (1 - (${siteEmbeddings.embedding} <-> ${JSON.stringify(queryEmbedding)}::vector)) as similarity
      FROM ${siteEmbeddings}
      WHERE ${siteEmbeddings.domainId} = ${domainId}
        AND ${siteEmbeddings.embedding} IS NOT NULL
      ORDER BY ${siteEmbeddings.embedding} <-> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `);

    const searchResults = (similarityResults as any[]).map((row: any) => ({
      id: row.id,
      url: row.url,
      title: row.title ?? undefined,
      content: row.content,
      contentSummary: row.content_summary ?? undefined,
      chunkIndex: row.chunk_index ?? undefined,
      metadata: row.metadata,
      similarity: parseFloat(row.similarity),
    }));

    return {
      domain: cleanDomain,
      searchResults,
    };
  } catch (error) {
    console.error(`Error getting information for domain ${domain}:`, error);
    return {
      domain,
      error: `Failed to retrieve information for domain: ${domain}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
