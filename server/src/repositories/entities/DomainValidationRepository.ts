import { eq } from 'drizzle-orm';
import { domainValidation, DomainValidation, NewDomainValidation } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

/**
 * Simple repository for domain validation checks.
 * Used to determine if a domain is pre-approved for automatic sender verification.
 */
export class DomainValidationRepository extends BaseRepository<
  typeof domainValidation,
  DomainValidation,
  NewDomainValidation
> {
  constructor() {
    super(domainValidation);
  }

  /**
   * Check if a domain exists in the validation table.
   * Used by sender verification flow to determine auto-approval.
   */
  async domainExists(domain: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.domain, domain.toLowerCase()))
      .limit(1);

    return !!result[0];
  }
}
