import { eq, desc } from 'drizzle-orm';
import { openAiEmbeddingClient } from '@/libs/openai.embeddings.client';
import { openAiClient } from '@/libs/openai.client';
import db from '@/libs/drizzleClient';
import { SiteEmbeddingDomain, siteEmbeddingDomains, siteEmbeddings } from '@/db';
import { chunkMarkdownForEmbedding } from './chunkMarkdownForEmbedding';

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
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, url))
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      const inserted = await tx
        .insert(siteEmbeddingDomains)
        .values({
          domain: url,
          scrapedAt: new Date(),
        })
        .returning();

      return inserted[0];
    });

    if (!result) {
      throw new Error('Failed to get or create domain');
    }

    return result;
  },
  getDateOfLastDomainScrape: async (domain: string): Promise<Date | undefined> => {
    const result = await db
      .select({ scrapedAt: siteEmbeddingDomains.scrapedAt })
      .from(siteEmbeddingDomains)
      .where(eq(siteEmbeddingDomains.domain, domain))
      .orderBy(desc(siteEmbeddingDomains.scrapedAt))
      .limit(1);

    return result[0]?.scrapedAt;
  },
  embeddAndGetSummary: async (
    domainId: string,
    chunkIndex: number,
    metadata: Record<string, any>,
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

    const slug = metadata.url.getUrlSlug();

    const embeddingDomain = await db.insert(siteEmbeddings).values({
      domainId,
      url: metadata.url.cleanWebsiteUrl(),
      slug,
      title: metadata.title,
      content: chunk,
      contentSummary: summary.choices[0].message.content,
      embedding: embedding.data[0]?.embedding,
      chunkIndex,
      tokenCount: chunk.length,
      firecrawlId: metadata.firecrawlId,
      metadata: {
        title,
        description,
      },
    });
    return embeddingDomain;
  },
};
