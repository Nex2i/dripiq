import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import db from '@/libs/drizzleClient';
import { siteEmbeddings, siteEmbeddingDomains } from '@/db/schema';
import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';

const TOP_K = 10;

export const GetInformationAboutDomainTool = new DynamicTool({
  name: 'GetInformationAboutDomainTool',
  description: 'Searches for specific information within a domain using semantic similarity. Use this format: {"domain": "example.com", "queryText": "what you want to search for"}. Provide a domain and a query text to find the most relevant content from that domain. Returns the most relevant content chunks with similarity scores.',
  func: async (input: string) => {
    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(input);
      } catch {
        return JSON.stringify({ error: 'Input must be valid JSON with domain and queryText fields. Example: {"domain": "example.com", "queryText": "search term"}' });
      }

      const { domain, queryText } = parsedInput;
      
      if (!domain || !queryText) {
        return JSON.stringify({ error: 'Both domain and queryText fields are required' });
      }

      const cleanDomain = domain.getDomain();

      const domainRecord = await db
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, cleanDomain))
        .limit(1);

      if (!domainRecord.length || !domainRecord[0]) {
        return JSON.stringify({
          domain: cleanDomain,
          error: `No embedding data found for domain: ${cleanDomain}`,
        });
      }

      const domainId = domainRecord[0].id;

      const queryEmbeddingResponse = await openAiEmbeddingClient.createEmbedding(queryText);
      const queryEmbedding = queryEmbeddingResponse.data[0]?.embedding;

      if (!queryEmbedding) {
        return JSON.stringify({
          domain: cleanDomain,
          error: 'Failed to generate embedding for query text',
        });
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

      return JSON.stringify({
        domain: cleanDomain,
        searchResults,
      });
    } catch (error) {
      console.error(`Error getting information for domain:`, error);
      return JSON.stringify({
        domain: 'unknown',
        error: `Failed to retrieve information for domain. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
});