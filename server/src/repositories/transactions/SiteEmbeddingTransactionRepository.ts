import { eq } from 'drizzle-orm';
import { SiteEmbeddingDomain, siteEmbeddingDomains } from '@/db/schema';
import { db } from '@/db';
import '../extensions';

export class SiteEmbeddingTransactionRepository {
  /**
   * Get or create a domain by URL in a transaction
   * Note: The url parameter should be a domain (e.g., "example.com"), not a full URL
   */
  static async getOrCreateDomainByUrl(url: string): Promise<SiteEmbeddingDomain> {
    // Ensure we have a proper domain, not a full URL
    const domain = url.includes('/') ? url.getFullDomain() : url;
    
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, domain))
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      const inserted = await tx
        .insert(siteEmbeddingDomains)
        .values({
          domain: domain,
          scrapedAt: new Date(),
        })
        .returning();

      return inserted[0];
    });

    if (!result) {
      throw new Error('Failed to get or create domain');
    }

    return result;
  }
}
