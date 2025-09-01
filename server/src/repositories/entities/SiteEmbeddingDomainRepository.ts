import { eq } from 'drizzle-orm';
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
    const cleanDomain = domain.getFullDomain();
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domain, cleanDomain))
      .limit(1);
    return results[0];
  }
}
