import { eq, desc, gt, lt } from 'drizzle-orm';
import { siteEmbeddingDomains, SiteEmbeddingDomain, NewSiteEmbeddingDomain } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export class SiteEmbeddingDomainRepository extends BaseRepository<
  typeof siteEmbeddingDomains,
  SiteEmbeddingDomain,
  NewSiteEmbeddingDomain
> {
  constructor() {
    super(siteEmbeddingDomains);
  }

  /**
   * Find domain by domain name
   */
  async findByDomain(domain: string): Promise<SiteEmbeddingDomain | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domain, domain))
      .limit(1);
    return results[0];
  }

  /**
   * Check if domain exists
   */
  async domainExists(domain: string): Promise<boolean> {
    const result = await this.findByDomain(domain);
    return !!result;
  }

  /**
   * Create domain if it doesn't exist
   */
  async createIfNotExists(data: NewSiteEmbeddingDomain): Promise<SiteEmbeddingDomain> {
    // Always extract the full domain to ensure consistency
    const domain = data.domain.getFullDomain();
    const normalizedData = { ...data, domain };
    
    const existing = await this.findByDomain(domain);
    if (existing) {
      return existing;
    }
    return await this.create(normalizedData);
  }

  /**
   * Update scraped timestamp
   */
  async updateScrapedAt(
    domainId: string,
    scrapedAt: Date = new Date()
  ): Promise<SiteEmbeddingDomain | undefined> {
    return await this.updateById(domainId, { scrapedAt });
  }

  /**
   * Find domains scraped after a certain date
   */
  async findScrapedAfter(date: Date): Promise<SiteEmbeddingDomain[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(gt(this.table.scrapedAt, date))
      .orderBy(desc(this.table.scrapedAt));
  }

  /**
   * Find domains scraped before a certain date
   */
  async findScrapedBefore(date: Date): Promise<SiteEmbeddingDomain[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(lt(this.table.scrapedAt, date))
      .orderBy(desc(this.table.scrapedAt));
  }

  /**
   * Find recently scraped domains
   */
  async findRecentlyScraped(hours: number = 24): Promise<SiteEmbeddingDomain[]> {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await this.findScrapedAfter(cutoffDate);
  }

  /**
   * Find stale domains (not scraped recently)
   */
  async findStaleDomains(hours: number = 168): Promise<SiteEmbeddingDomain[]> {
    // Default 7 days
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await this.findScrapedBefore(cutoffDate);
  }

  /**
   * Find all domains ordered by scrape date
   */
  async findAllOrderedByScrapedAt(ascending: boolean = false): Promise<SiteEmbeddingDomain[]> {
    return await this.db
      .select()
      .from(this.table)
      .orderBy(ascending ? this.table.scrapedAt : desc(this.table.scrapedAt));
  }

  /**
   * Get domains with embedding count
   */
  async findDomainsWithEmbeddingCount(): Promise<
    Array<SiteEmbeddingDomain & { embeddingCount: number }>
  > {
    // This would require a join with siteEmbeddings table
    // For now, return domains without count - this can be enhanced later
    const domains = await this.findAll();
    return domains.map((domain) => ({ ...domain, embeddingCount: 0 }));
  }

  /**
   * Delete domain and all associated embeddings
   */
  async deleteWithEmbeddings(domainId: string): Promise<SiteEmbeddingDomain | undefined> {
    // Note: This will cascade delete embeddings due to foreign key constraint
    return await this.deleteById(domainId);
  }

  /**
   * Search domains by partial domain name
   */
  async searchByDomainName(searchTerm: string): Promise<SiteEmbeddingDomain[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domain, `%${searchTerm}%`))
      .orderBy(this.table.domain);
  }
}
