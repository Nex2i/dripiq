import { eq } from 'drizzle-orm';
import { siteEmbeddingDomains, SiteEmbeddingDomain, NewSiteEmbeddingDomain } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export class SiteEmbeddingDomainRepository extends BaseRepository implements IRepository<SiteEmbeddingDomain, NewSiteEmbeddingDomain> {
  /**
   * Find site embedding domain by ID
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<SiteEmbeddingDomain | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Find site embedding domain by domain name
   */
  async findByDomain(domain: string, tenantId: string, userId?: string): Promise<SiteEmbeddingDomain | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, domain))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByDomain');
    }
  }

  /**
   * Create a new site embedding domain
   */
  async create(domainData: NewSiteEmbeddingDomain, tenantId: string, userId?: string): Promise<SiteEmbeddingDomain> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [domain] = await this.db.insert(siteEmbeddingDomains).values(domainData).returning();
      if (!domain) {
        throw new Error('Failed to create site embedding domain');
      }
      return domain;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update site embedding domain
   */
  async update(id: string, updateData: Partial<NewSiteEmbeddingDomain>, tenantId: string, userId?: string): Promise<SiteEmbeddingDomain> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [domain] = await this.db
        .update(siteEmbeddingDomains)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(siteEmbeddingDomains.id, id))
        .returning();

      if (!domain) {
        throw new Error('Site embedding domain not found');
      }
      return domain;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete site embedding domain
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<SiteEmbeddingDomain> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [domain] = await this.db
        .delete(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.id, id))
        .returning();

      if (!domain) {
        throw new Error('Site embedding domain not found');
      }
      return domain;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all site embedding domains
   */
  async findAll(tenantId: string, userId?: string): Promise<SiteEmbeddingDomain[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddingDomains)
        .orderBy(siteEmbeddingDomains.domain);
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  /**
   * Find domains that need scraping (older than a certain date)
   */
  async findDomainsForScraping(tenantId: string, olderThan: Date, userId?: string): Promise<SiteEmbeddingDomain[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.scrapedAt, olderThan))
        .orderBy(siteEmbeddingDomains.scrapedAt);
    } catch (error) {
      this.handleError(error, 'findDomainsForScraping');
    }
  }

  /**
   * Update scraped timestamp
   */
  async updateScrapedAt(id: string, scrapedAt: Date, tenantId: string, userId?: string): Promise<SiteEmbeddingDomain> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.update(id, { scrapedAt }, tenantId, userId);
    } catch (error) {
      this.handleError(error, 'updateScrapedAt');
    }
  }

  /**
   * Check if domain exists
   */
  async domainExists(domain: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: siteEmbeddingDomains.id })
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, domain))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'domainExists');
    }
  }
}