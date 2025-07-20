import { sql, eq } from 'drizzle-orm';
import db from '@/libs/drizzleClient';
import { siteEmbeddings, siteEmbeddingDomains } from '@/db/schema';
import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';

const TOP_K = 10;

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
  queryText: string
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
        ${siteEmbeddings.chunkIndex},
        ${siteEmbeddings.metadata},
        (1 - (${siteEmbeddings.embedding} <-> ${JSON.stringify(queryEmbedding)}::vector)) as similarity
      FROM ${siteEmbeddings}
      WHERE ${siteEmbeddings.domainId} = ${domainId}
        AND ${siteEmbeddings.embedding} IS NOT NULL
      ORDER BY ${siteEmbeddings.embedding} <-> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${TOP_K}
    `);

    const searchResults = (similarityResults as any[])
      .map((row: any) => ({
        id: row.id,
        url: row.url,
        title: row.title ?? undefined,
        content: row.content,
        chunkIndex: row.chunk_index ?? undefined,
        metadata: row.metadata,
        similarity: parseFloat(row.similarity),
      }))
      .sort((a, b) => b.similarity - a.similarity);

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
