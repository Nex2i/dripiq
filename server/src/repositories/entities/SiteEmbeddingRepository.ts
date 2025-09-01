import { eq, sql } from 'drizzle-orm';
import { siteEmbeddings, SiteEmbedding, NewSiteEmbedding } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

const TOP_K_DEFAULT = 10;

export interface EmbeddingSearchOptions {
  limit?: number;
  offset?: number;
  minTokenCount?: number;
  maxTokenCount?: number;
  domainId?: string;
  url?: string;
  slug?: string;
}

export interface EmbeddingWithDomain extends SiteEmbedding {
  domain?: {
    id: string;
    domain: string;
    scrapedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export class SiteEmbeddingRepository extends BaseRepository<
  typeof siteEmbeddings,
  SiteEmbedding,
  NewSiteEmbedding
> {
  constructor() {
    super(siteEmbeddings);
  }

  /**
   * Find embeddings by URL
   */
  async findByUrl(url: string): Promise<SiteEmbedding[]> {
    const cleanUrl = url.getFullDomain();
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.url, cleanUrl))) as SiteEmbedding[];
  }

  /**
   * Find embeddings by domain ID and text similarity
   */
  async findByDomainIdAndTextSimilarity(
    domainId: string,
    queryEmbedding: number[],
    topK: number = TOP_K_DEFAULT
  ): Promise<SiteEmbedding[]> {
    return await this.db.execute(sql`
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
      LIMIT ${topK}
    `);
  }

  /**
   * Get all unique page URLs for a domain
   */
  async getUniquePageUrls(domainId: string): Promise<string[]> {
    const results = await this.db
      .selectDistinct({ url: this.table.url })
      .from(this.table)
      .where(eq(this.table.domainId, domainId));
    return results.map((r) => r.url);
  }
}
