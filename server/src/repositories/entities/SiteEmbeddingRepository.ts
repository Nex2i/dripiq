import { eq, and, gte, lte, desc, asc } from 'drizzle-orm';
import { BaseRepository } from '../base/BaseRepository';
import { siteEmbeddings, SiteEmbedding, NewSiteEmbedding, siteEmbeddingDomains } from '@/db/schema';

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
    scrapedAt: Date;
  };
}

export class SiteEmbeddingRepository extends BaseRepository<typeof siteEmbeddings, SiteEmbedding, NewSiteEmbedding> {
  constructor() {
    super(siteEmbeddings);
  }

  /**
   * Find embeddings by domain ID
   */
  async findByDomainId(domainId: string): Promise<SiteEmbedding[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domainId, domainId))
      .orderBy(this.table.url, this.table.chunkIndex);
  }

  /**
   * Find embeddings by URL
   */
  async findByUrl(url: string): Promise<SiteEmbedding[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.url, url))
      .orderBy(this.table.chunkIndex);
  }

  /**
   * Find embeddings by slug
   */
  async findBySlug(slug: string): Promise<SiteEmbedding[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.slug, slug))
      .orderBy(this.table.chunkIndex);
  }

  /**
   * Find embeddings with options
   */
  async findWithOptions(options: EmbeddingSearchOptions = {}): Promise<SiteEmbedding[]> {
    const {
      limit = 100,
      offset = 0,
      minTokenCount,
      maxTokenCount,
      domainId,
      url,
      slug
    } = options;

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
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(this.table.url, this.table.chunkIndex)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find embeddings with domain information
   */
  async findWithDomain(options: EmbeddingSearchOptions = {}): Promise<EmbeddingWithDomain[]> {
    const {
      limit = 100,
      offset = 0,
      minTokenCount,
      maxTokenCount,
      domainId,
      url,
      slug
    } = options;

    let query = this.db
      .select({
        id: this.table.id,
        domainId: this.table.domainId,
        url: this.table.url,
        slug: this.table.slug,
        title: this.table.title,
        content: this.table.content,
        contentSummary: this.table.contentSummary,
        chunkIndex: this.table.chunkIndex,
        embedding: this.table.embedding,
        tokenCount: this.table.tokenCount,
        metadata: this.table.metadata,
        firecrawlId: this.table.firecrawlId,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
        domain: {
          id: siteEmbeddingDomains.id,
          domain: siteEmbeddingDomains.domain,
          scrapedAt: siteEmbeddingDomains.scrapedAt,
        }
      })
      .from(this.table)
      .innerJoin(siteEmbeddingDomains, eq(this.table.domainId, siteEmbeddingDomains.id));

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
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(this.table.url, this.table.chunkIndex)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find embeddings by firecrawl ID
   */
  async findByFirecrawlId(firecrawlId: string): Promise<SiteEmbedding[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.firecrawlId, firecrawlId))
      .orderBy(this.table.chunkIndex);
  }

  /**
   * Find embeddings by token count range
   */
  async findByTokenCountRange(minTokens: number, maxTokens: number): Promise<SiteEmbedding[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(gte(this.table.tokenCount, minTokens), lte(this.table.tokenCount, maxTokens)))
      .orderBy(desc(this.table.tokenCount));
  }

  /**
   * Count embeddings by domain
   */
  async countByDomainId(domainId: string): Promise<number> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domainId, domainId));
    return results.length;
  }

  /**
   * Count embeddings by URL
   */
  async countByUrl(url: string): Promise<number> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.url, url));
    return results.length;
  }

  /**
   * Delete all embeddings for a domain
   */
  async deleteAllForDomain(domainId: string): Promise<SiteEmbedding[]> {
    return await this.db
      .delete(this.table)
      .where(eq(this.table.domainId, domainId))
      .returning();
  }

  /**
   * Delete all embeddings for a URL
   */
  async deleteAllForUrl(url: string): Promise<SiteEmbedding[]> {
    return await this.db
      .delete(this.table)
      .where(eq(this.table.url, url))
      .returning();
  }

  /**
   * Update content summary
   */
  async updateContentSummary(id: string, contentSummary: string): Promise<SiteEmbedding | undefined> {
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
  async findByContentText(searchText: string, options: EmbeddingSearchOptions = {}): Promise<SiteEmbedding[]> {
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
    
    const totalTokens = embeddings.reduce((total, embedding) => total + (embedding.tokenCount || 0), 0);
    return Math.round(totalTokens / embeddings.length);
  }
}