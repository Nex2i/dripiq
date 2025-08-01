import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { siteEmbeddings, SiteEmbedding, NewSiteEmbedding, siteEmbeddingDomains } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

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
   * Find embeddings by domain ID
   */
  async findByDomainId(domainId: string): Promise<SiteEmbedding[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domainId, domainId))) as SiteEmbedding[];
  }

  /**
   * Find embeddings by URL
   */
  async findByUrl(url: string): Promise<SiteEmbedding[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.url, url))) as SiteEmbedding[];
  }

  /**
   * Find embeddings by URL and chunk index
   */
  async findByUrlAndChunk(url: string, chunkIndex: number): Promise<SiteEmbedding | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.url, url), eq(this.table.chunkIndex, chunkIndex)))
      .limit(1);
    return results[0] as SiteEmbedding | undefined;
  }

  /**
   * Search embeddings with filters
   */
  async search(options: EmbeddingSearchOptions = {}): Promise<SiteEmbedding[]> {
    const { limit = 50, offset = 0, minTokenCount, maxTokenCount, domainId, url, slug } = options;

    let query = this.db.select().from(this.table);

    // Build where conditions
    const conditions = [];

    if (domainId) {
      conditions.push(eq(this.table.domainId, domainId));
    }

    if (url) {
      conditions.push(eq(this.table.url, url));
    }

    if (slug) {
      conditions.push(eq(this.table.slug, slug));
    }

    if (minTokenCount !== undefined) {
      conditions.push(gte(this.table.tokenCount, minTokenCount));
    }

    if (maxTokenCount !== undefined) {
      conditions.push(lte(this.table.tokenCount, maxTokenCount));
    }

    if (conditions.length > 0) {
      query = (query as any).where(and(...conditions));
    }

    return await (query as any)
      .orderBy(this.table.url, this.table.chunkIndex)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find embeddings with domain details
   */
  async findWithDomain(options: EmbeddingSearchOptions = {}): Promise<EmbeddingWithDomain[]> {
    const { limit = 50, offset = 0, minTokenCount, maxTokenCount, domainId, url, slug } = options;

    let query = this.db
      .select({
        id: this.table.id,
        url: this.table.url,
        slug: this.table.slug,
        chunkIndex: this.table.chunkIndex,
        content: this.table.content,
        tokenCount: this.table.tokenCount,
        embedding: this.table.embedding,
        domainId: this.table.domainId,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
        domain: {
          id: siteEmbeddingDomains.id,
          domain: siteEmbeddingDomains.domain,
          scrapedAt: siteEmbeddingDomains.scrapedAt,
          createdAt: siteEmbeddingDomains.createdAt,
          updatedAt: siteEmbeddingDomains.updatedAt,
        },
      })
      .from(this.table)
      .leftJoin(siteEmbeddingDomains, eq(this.table.domainId, siteEmbeddingDomains.id));

    // Build where conditions
    const conditions = [];

    if (domainId) {
      conditions.push(eq(this.table.domainId, domainId));
    }

    if (url) {
      conditions.push(eq(this.table.url, url));
    }

    if (slug) {
      conditions.push(eq(this.table.slug, slug));
    }

    if (minTokenCount !== undefined) {
      conditions.push(gte(this.table.tokenCount, minTokenCount));
    }

    if (maxTokenCount !== undefined) {
      conditions.push(lte(this.table.tokenCount, maxTokenCount));
    }

    if (conditions.length > 0) {
      query = (query as any).where(and(...conditions));
    }

    return await (query as any)
      .orderBy(this.table.url, this.table.chunkIndex)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count embeddings for domain
   */
  async countByDomain(domainId: string): Promise<number> {
    const result = await this.db.select().from(this.table).where(eq(this.table.domainId, domainId));
    return result.length;
  }

  /**
   * Delete all embeddings for a domain
   */
  async deleteAllForDomain(domainId: string): Promise<SiteEmbedding[]> {
    return await this.db.delete(this.table).where(eq(this.table.domainId, domainId)).returning();
  }

  /**
   * Delete all embeddings for a URL
   */
  async deleteAllForUrl(url: string): Promise<SiteEmbedding[]> {
    return await this.db.delete(this.table).where(eq(this.table.url, url)).returning();
  }

  /**
   * Update content summary
   */
  async updateContentSummary(
    id: string,
    contentSummary: string
  ): Promise<SiteEmbedding | undefined> {
    return await this.updateById(id, { contentSummary });
  }

  /**
   * Update metadata
   */
  async updateMetadata(id: string, metadata: any): Promise<SiteEmbedding | undefined> {
    return await this.updateById(id, { metadata });
  }

  /**
   * Find embeddings with content containing specific text
   */
  async findByContentText(
    searchText: string,
    options: EmbeddingSearchOptions = {}
  ): Promise<SiteEmbedding[]> {
    const { limit = 100, offset = 0 } = options;

    // Note: This uses a simple text search. For more advanced text search,
    // you might want to use PostgreSQL's full-text search capabilities
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.content, `%${searchText}%`))
      .orderBy(this.table.createdAt)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get total token count for domain
   */
  async getTotalTokenCountForDomain(domainId: string): Promise<number> {
    const embeddings = await this.findByDomainId(domainId);
    return embeddings.reduce((total, embedding) => total + (embedding.tokenCount || 0), 0);
  }

  /**
   * Get average token count for domain
   */
  async getAverageTokenCountForDomain(domainId: string): Promise<number> {
    const embeddings = await this.findByDomainId(domainId);
    if (embeddings.length === 0) return 0;

    const totalTokens = embeddings.reduce(
      (total, embedding) => total + (embedding.tokenCount || 0),
      0
    );
    return Math.round(totalTokens / embeddings.length);
  }

  /**
   * Delete embeddings by URL
   */
  async deleteByUrl(url: string): Promise<SiteEmbedding[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.url, url))
      .returning()) as SiteEmbedding[];
  }

  /**
   * Update embedding content
   */
  async updateContent(
    id: string,
    content: string,
    tokenCount: number
  ): Promise<SiteEmbedding | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ content, tokenCount, updatedAt: new Date() })
      .where(eq(this.table.id, id))
      .returning();
    return result as SiteEmbedding | undefined;
  }

  /**
   * Update embedding vector
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<SiteEmbedding | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ embedding, updatedAt: new Date() })
      .where(eq(this.table.id, id))
      .returning();
    return result as SiteEmbedding | undefined;
  }

  /**
   * Find embeddings by text similarity (for future vector search implementation)
   */
  async findSimilar(
    _queryEmbedding: number[],
    limit: number = 10,
    _threshold: number = 0.8
  ): Promise<SiteEmbedding[]> {
    // This is a placeholder for vector similarity search
    // In production, you would use pgvector extension with cosine similarity
    // For now, return all embeddings limited by count
    return (await this.db.select().from(this.table).limit(limit)) as SiteEmbedding[];
  }

  /**
   * Get token count statistics for domain
   */
  async getTokenStats(domainId?: string) {
    let query = this.db
      .select({
        count: this.table.id,
        minTokens: this.table.tokenCount,
        maxTokens: this.table.tokenCount,
        avgTokens: this.table.tokenCount,
      })
      .from(this.table);

    if (domainId) {
      query = (query as any).where(eq(this.table.domainId, domainId));
    }

    // Note: This is a simplified version. In production, you'd use proper aggregation functions
    const results = await query;

    if (results.length === 0) {
      return {
        count: 0,
        minTokens: 0,
        maxTokens: 0,
        avgTokens: 0,
      };
    }

    const tokenCounts = results
      .map((r) => r.avgTokens)
      .filter((count): count is number => count !== null);

    if (tokenCounts.length === 0) {
      return {
        count: results.length,
        minTokens: 0,
        maxTokens: 0,
        avgTokens: 0,
      };
    }

    return {
      count: results.length,
      minTokens: Math.min(...tokenCounts),
      maxTokens: Math.max(...tokenCounts),
      avgTokens: Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length),
    };
  }

  /**
   * Get unique URLs for domain
   */
  async getUniqueUrls(domainId: string): Promise<string[]> {
    const results = await this.db
      .selectDistinct({ url: this.table.url })
      .from(this.table)
      .where(eq(this.table.domainId, domainId))
      .orderBy(asc(this.table.url));

    return results.map((r) => r.url);
  }

  /**
   * Get chunk count by URL
   */
  async getChunkCountByUrl(url: string): Promise<number> {
    const results = await this.db.select().from(this.table).where(eq(this.table.url, url));
    return results.length;
  }
}
