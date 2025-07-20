import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import db from '@/libs/drizzleClient';
import { siteEmbeddings, siteEmbeddingDomains } from '@/db/schema';
import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';

const TOP_K = 10;

export const GetInformationAboutDomainTool = new DynamicTool({
  name: 'GetInformationAboutDomainTool',
  description: 'Searches for specific information within a domain using semantic similarity. Requires two parameters: domain (the domain to search, e.g. "example.com") and queryText (what you want to search for). Returns the most relevant content chunks with similarity scores.',
  func: async (input: string) => {
    try {
      let domain: string;
      let queryText: string;

      // Try to parse as JSON first
      try {
        const parsedInput = JSON.parse(input);
        domain = parsedInput.domain;
        queryText = parsedInput.queryText;
      } catch {
        // If JSON parsing fails, try to parse as LangChain tool call format
        try {
          // LangChain might pass tool arguments as a stringified object
          const toolMatch = input.match(/GetInformationAboutDomainTool\(\s*({[^}]+})\s*\)/);
          if (toolMatch) {
            const argsJson = toolMatch[1];
            const args = JSON.parse(argsJson);
            domain = args.input || args.domain;
            queryText = args.queryText;
          } else {
            // Try to extract domain and queryText from the input string
            const lines = input.split('\n');
            for (const line of lines) {
              if (line.includes('input') || line.includes('domain')) {
                const domainMatch = line.match(/"([^"]+)"/);
                if (domainMatch) domain = domainMatch[1];
              }
              if (line.includes('queryText')) {
                const queryMatch = line.match(/"([^"]+)"/);
                if (queryMatch) queryText = queryMatch[1];
              }
            }
          }
        } catch {
          return JSON.stringify({ 
            error: 'Could not parse input. Expected format: {"domain": "example.com", "queryText": "search term"}',
            receivedInput: input 
          });
        }
      }
      
      if (!domain || !queryText) {
        return JSON.stringify({ 
          error: 'Both domain and queryText are required',
          received: { domain, queryText }
        });
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