import { DynamicStructuredTool } from '@langchain/core/tools';
import z from 'zod';
import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';
import { siteEmbeddingDomainRepository, siteEmbeddingRepository } from '@/repositories';
import { logger } from '@/libs/logger';

export const GetInformationAboutDomainTool = new DynamicStructuredTool({
  name: 'GetInformationAboutDomainTool',
  description:
    'Searches for specific information within a domain using semantic similarity. Call with arguments: domain (string) and queryText (string). Returns the most relevant content chunks with similarity scores.',
  schema: z.object({
    domain: z.string().describe('The domain name to search for information about'),
    queryText: z.string().describe('The text to search for within the domain'),
  }),
  func: async (input: { domain: string; queryText: string }) => {
    try {
      const { domain, queryText } = input;

      if (!domain || !queryText) {
        return JSON.stringify({
          error: 'Both domain and queryText are required',
          received: { domain, queryText },
          input_received: input,
        });
      }

      const cleanDomain = domain.getDomain();
      logger.info(`Searching for "${queryText}" in domain: ${cleanDomain}`);

      const domainRecord = await siteEmbeddingDomainRepository.findByDomain(cleanDomain);

      if (!domainRecord) {
        return JSON.stringify({
          domain: cleanDomain,
          error: `No embedding data found for domain: ${cleanDomain}`,
        });
      }

      const queryEmbedding = await openAiEmbeddingClient.embedQuery(queryText);

      if (!queryEmbedding) {
        return JSON.stringify({
          domain: cleanDomain,
          error: 'Failed to generate embedding for query text',
        });
      }

      const similarityResults = await siteEmbeddingRepository.findByDomainIdAndTextSimilarity(
        domainRecord.id,
        queryEmbedding
      );

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
      logger.error(`Error getting information for domain`, error);
      return JSON.stringify({
        domain: 'unknown',
        error: `Failed to retrieve information for domain. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});
