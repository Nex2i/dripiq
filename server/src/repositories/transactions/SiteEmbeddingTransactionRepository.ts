import { eq } from 'drizzle-orm';
import { SiteEmbeddingDomain, siteEmbeddingDomains } from '@/db/schema';
import { db } from '@/db';

export class SiteEmbeddingTransactionRepository {
  /**
   * Get or create a domain by URL in a transaction
   */
  static async getOrCreateDomainByUrl(url: string): Promise<SiteEmbeddingDomain> {
    const cleanUrl = url.getFullDomain();
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(siteEmbeddingDomains)
        .where(eq(siteEmbeddingDomains.domain, cleanUrl))
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      const inserted = await tx
        .insert(siteEmbeddingDomains)
        .values({
          domain: cleanUrl,
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
