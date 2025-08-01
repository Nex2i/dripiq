import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';
import { transactionRepository, siteEmbeddingDomainRepository, siteEmbeddingRepository } from '@/repositories';
import { SiteEmbeddingDomain } from '@/db/schema';
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
  getOrCreateDomainByUrl: async (url: string, tenantId: string = 'system', userId?: string): Promise<SiteEmbeddingDomain> => {
    return await transactionRepository.getOrCreateSiteEmbeddingDomain(url, tenantId, userId);
  },
  getDateOfLastDomainScrape: async (domain: string, tenantId: string = 'system', userId?: string): Promise<Date | undefined> => {
    const domainRecord = await siteEmbeddingDomainRepository.findByDomain(domain, tenantId, userId);
    return domainRecord?.scrapedAt;
  },
  embeddAndGetSummary: async (
    domainId: string,
    chunkIndex: number,
    metadata: Record<string, any>,
    chunk: string,
    generateSummary: boolean = false,
    tenantId: string = 'system',
    userId?: string
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

    const embeddingData = {
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
    };

    return await siteEmbeddingRepository.create(embeddingData, tenantId, userId);
  },
};
