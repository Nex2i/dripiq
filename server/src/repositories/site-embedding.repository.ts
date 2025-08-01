import { eq, and, gte, lte } from 'drizzle-orm';
import { siteEmbeddings, siteEmbeddingDomains, SiteEmbedding, NewSiteEmbedding, SiteEmbeddingDomain } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export interface SiteEmbeddingWithDomain extends SiteEmbedding {
  domain: SiteEmbeddingDomain;
}

export class SiteEmbeddingRepository extends BaseRepository implements IRepository<SiteEmbedding, NewSiteEmbedding> {
  /**
   * Find site embedding by ID
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<SiteEmbedding | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new site embedding
   */
  async create(embeddingData: NewSiteEmbedding, tenantId: string, userId?: string): Promise<SiteEmbedding> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [embedding] = await this.db.insert(siteEmbeddings).values(embeddingData).returning();
      if (!embedding) {
        throw new Error('Failed to create site embedding');
      }
      return embedding;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update site embedding
   */
  async update(id: string, updateData: Partial<NewSiteEmbedding>, tenantId: string, userId?: string): Promise<SiteEmbedding> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [embedding] = await this.db
        .update(siteEmbeddings)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(siteEmbeddings.id, id))
        .returning();

      if (!embedding) {
        throw new Error('Site embedding not found');
      }
      return embedding;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete site embedding
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<SiteEmbedding> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [embedding] = await this.db
        .delete(siteEmbeddings)
        .where(eq(siteEmbeddings.id, id))
        .returning();

      if (!embedding) {
        throw new Error('Site embedding not found');
      }
      return embedding;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find embeddings by domain ID
   */
  async findByDomain(domainId: string, tenantId: string, userId?: string): Promise<SiteEmbedding[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.domainId, domainId))
        .orderBy(siteEmbeddings.chunkIndex);
    } catch (error) {
      this.handleError(error, 'findByDomain');
    }
  }

  /**
   * Find embeddings by URL
   */
  async findByUrl(url: string, tenantId: string, userId?: string): Promise<SiteEmbedding[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.url, url))
        .orderBy(siteEmbeddings.chunkIndex);
    } catch (error) {
      this.handleError(error, 'findByUrl');
    }
  }

  /**
   * Find embeddings by Firecrawl ID
   */
  async findByFirecrawlId(firecrawlId: string, tenantId: string, userId?: string): Promise<SiteEmbedding[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.firecrawlId, firecrawlId))
        .orderBy(siteEmbeddings.chunkIndex);
    } catch (error) {
      this.handleError(error, 'findByFirecrawlId');
    }
  }

  /**
   * Find embeddings with domain information
   */
  async findByDomainWithDetails(domainId: string, tenantId: string, userId?: string): Promise<SiteEmbeddingWithDomain[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(siteEmbeddings)
        .innerJoin(siteEmbeddingDomains, eq(siteEmbeddings.domainId, siteEmbeddingDomains.id))
        .where(eq(siteEmbeddings.domainId, domainId))
        .orderBy(siteEmbeddings.chunkIndex);

      return result.map((row) => ({
        ...row.site_embeddings,
        domain: row.site_embedding_domains,
      }));
    } catch (error) {
      this.handleError(error, 'findByDomainWithDetails');
    }
  }

  /**
   * Find embeddings by token count range
   */
  async findByTokenCountRange(minTokens: number, maxTokens: number, tenantId: string, userId?: string): Promise<SiteEmbedding[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddings)
        .where(and(
          gte(siteEmbeddings.tokenCount, minTokens),
          lte(siteEmbeddings.tokenCount, maxTokens)
        ))
        .orderBy(siteEmbeddings.tokenCount);
    } catch (error) {
      this.handleError(error, 'findByTokenCountRange');
    }
  }

  /**
   * Delete all embeddings for a domain
   */
  async deleteByDomain(domainId: string, tenantId: string, userId?: string): Promise<number> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const deleted = await this.db
        .delete(siteEmbeddings)
        .where(eq(siteEmbeddings.domainId, domainId))
        .returning({ id: siteEmbeddings.id });

      return deleted.length;
    } catch (error) {
      this.handleError(error, 'deleteByDomain');
    }
  }

  /**
   * Delete embeddings by URL
   */
  async deleteByUrl(url: string, tenantId: string, userId?: string): Promise<number> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const deleted = await this.db
        .delete(siteEmbeddings)
        .where(eq(siteEmbeddings.url, url))
        .returning({ id: siteEmbeddings.id });

      return deleted.length;
    } catch (error) {
      this.handleError(error, 'deleteByUrl');
    }
  }

  /**
   * Count embeddings by domain
   */
  async countByDomain(domainId: string, tenantId: string, userId?: string): Promise<number> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select({ count: siteEmbeddings.id })
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.domainId, domainId));

      return result.length;
    } catch (error) {
      this.handleError(error, 'countByDomain');
    }
  }

  /**
   * Find embeddings with specific content patterns (for search)
   */
  async findByContentPattern(pattern: string, tenantId: string, userId?: string): Promise<SiteEmbedding[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddings)
        .where(eq(siteEmbeddings.content, pattern))
        .orderBy(siteEmbeddings.createdAt);
    } catch (error) {
      this.handleError(error, 'findByContentPattern');
    }
  }

  /**
   * Get embedding statistics for a domain
   */
  async getDomainStats(domainId: string, tenantId: string, userId?: string): Promise<{
    totalEmbeddings: number;
    totalTokens: number;
    avgTokensPerEmbedding: number;
    uniqueUrls: number;
  }> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const embeddings = await this.findByDomain(domainId, tenantId, userId);
      
      const totalEmbeddings = embeddings.length;
      const totalTokens = embeddings.reduce((sum, emb) => sum + (emb.tokenCount || 0), 0);
      const avgTokensPerEmbedding = totalEmbeddings > 0 ? totalTokens / totalEmbeddings : 0;
      const uniqueUrls = new Set(embeddings.map(emb => emb.url)).size;

      return {
        totalEmbeddings,
        totalTokens,
        avgTokensPerEmbedding,
        uniqueUrls,
      };
    } catch (error) {
      this.handleError(error, 'getDomainStats');
    }
  }
}