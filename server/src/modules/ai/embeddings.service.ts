import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';
import {
  ScrapingResultItem,
  ScrapingResultMarkdown,
  ScrapingResultMetadata,
} from './scraping.service';
import { chunkMarkdownForEmbedding } from './chunkMarkdownForEmbedding';
import { openAiClient } from '@/libs/openai.client';
import db from '@/libs/drizzleClient';
import { siteEmbeddingDomains, siteEmbeddings } from '@/db';

export const EmbeddingsService = {
  batchCreateSiteEmbedding: async (url: string, scrapingResultItems: ScrapingResultItem[]) => {
    const siteEmbeddingDomainUpdate = await db
      .insert(siteEmbeddingDomains)
      .values({
        domain: url.getDomain(),
        scrapedAt: new Date(),
      })
      .returning();

    if (!siteEmbeddingDomainUpdate || siteEmbeddingDomainUpdate.length === 0) {
      throw new Error('Failed to create siteEmbeddingDomain');
    }

    const domainId = siteEmbeddingDomainUpdate[0]?.id;

    await Promise.allSettled(
      scrapingResultItems.map(async (scrapingResultItem) => {
        await EmbeddingsService.createSiteEmbedding(scrapingResultItem, domainId);
      })
    );
  },

  createSiteEmbedding: async (scrapingResultItem: ScrapingResultItem, domainId?: string) => {
    const { url, metadata, markdown } = scrapingResultItem;

    if (!domainId) {
      const siteEmbeddingDomainUpdate = await db
        .insert(siteEmbeddingDomains)
        .values({
          domain: url.getDomain(),
          scrapedAt: new Date(),
        })
        .returning();

      if (!siteEmbeddingDomainUpdate || siteEmbeddingDomainUpdate.length === 0) {
        throw new Error('Failed to create siteEmbeddingDomain');
      }

      domainId = siteEmbeddingDomainUpdate[0]?.id;
    }

    if (!domainId) {
      throw new Error('Domain ID is required');
    }

    const chunks = chunkMarkdownForEmbedding(getMarkdownForEmbedding(markdown));

    // in parallel, create embeddings for each chunk
    await Promise.allSettled(
      chunks.map(async (chunk, chunkIndex) => {
        await EmbeddingsService.embeddAndGetSummary(domainId, chunkIndex, url, metadata, chunk);
      })
    );
  },

  embeddAndGetSummary: async (
    domainId: string,
    chunkIndex: number,
    url: string,
    metadata: ScrapingResultMetadata,
    chunk: string
  ) => {
    const { title, description } = metadata;
    const embedding = await openAiEmbeddingClient.createEmbedding(chunk);

    const summary = await openAiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Summarize the following text: \n' + chunk }],
    });

    if (!summary.choices[0]?.message.content) {
      throw new Error('Failed to get summary');
    }

    const slug = url.getUrlSlug();

    const embeddingDomain = await db.insert(siteEmbeddings).values({
      domainId,
      url,
      slug,
      title: metadata.title,
      content: chunk,
      contentSummary: summary.choices[0].message.content,
      embedding: embedding.data[0]?.embedding,
      chunkIndex,
      tokenCount: chunk.length,
      metadata: {
        title,
        description,
      },
    });
    return embeddingDomain;
  },
};

function getMarkdownForEmbedding(markdown: ScrapingResultMarkdown) {
  const { markdown_with_citations, raw_markdown, references_markdown } = markdown;
  const markdownToEmbed = raw_markdown || markdown_with_citations || references_markdown;
  return markdownToEmbed;
}
