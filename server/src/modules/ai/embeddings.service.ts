import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';
import { SiteEmbeddingTransactionRepository } from '@/repositories/transactions/SiteEmbeddingTransactionRepository';
import { SiteEmbeddingDomain } from '@/db';

import { siteEmbeddingDomainRepository, siteEmbeddingRepository } from '@/repositories';
import { createChatModel, defaultLangChainConfig } from './langchain/config/langchain.config';
import { chunkMarkdownForEmbedding } from './chunkMarkdownForEmbedding';
import { getContentFromMessage } from './langchain/utils/messageUtils';

export const EmbeddingsService = {
  createFirecrawlSiteEmbedding: async (
    domain: SiteEmbeddingDomain,
    pureMarkdown: string,
    metadata: Record<string, any>
  ) => {
    const chunks = chunkMarkdownForEmbedding(pureMarkdown);

    await Promise.allSettled(
      chunks.map(async (chunk, chunkIndex) => {
        await EmbeddingsService.embeddAndGetSummary(domain.id, chunkIndex, metadata, chunk);
      })
    );
  },
  getOrCreateDomainByUrl: async (url: string): Promise<SiteEmbeddingDomain> => {
    return await SiteEmbeddingTransactionRepository.getOrCreateDomainByUrl(url);
  },
  getDateOfLastDomainScrape: async (domain: string): Promise<Date | undefined> => {
    const domainRecord = await siteEmbeddingDomainRepository.findByDomain(domain);
    return domainRecord?.scrapedAt || undefined;
  },
  embeddAndGetSummary: async (
    domainId: string,
    chunkIndex: number,
    metadata: Record<string, any>,
    chunk: string,
    generateSummary: boolean = false
  ) => {
    const { title, description } = metadata;
    const embedding = await openAiEmbeddingClient.embedQuery(chunk);

    let summary = '';
    if (generateSummary) {
      const chatModel = createChatModel({ model: defaultLangChainConfig.model });
      const summaryResponse = await chatModel.invoke([
        { role: 'user', content: 'Summarize the following text: \n' + chunk },
      ]);

      if (!summaryResponse.content) {
        throw new Error('Failed to get summary');
      }

      summary = getContentFromMessage(summaryResponse);
    }

    const slug = metadata.url.getUrlSlug();

    const embeddingRecord = await siteEmbeddingRepository.create({
      domainId,
      url: metadata.url.cleanWebsiteUrl(),
      slug,
      title: metadata.title,
      content: chunk,
      contentSummary: summary,
      embedding: embedding,
      chunkIndex,
      tokenCount: chunk.length,
      firecrawlId: metadata.firecrawlId,
      metadata: {
        title,
        description,
      },
    });
    return embeddingRecord;
  },
};
