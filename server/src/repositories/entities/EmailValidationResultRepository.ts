import { and, eq, desc } from 'drizzle-orm';
import {
  emailValidationResults,
  EmailValidationResult,
  NewEmailValidationResult,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>EmailValidationResultRepository caches SendGrid (or provider) validation results.</summary>
 * <summary>Reduces repeated verification calls and accelerates list hygiene decisions.</summary>
 * <summary>Consulted during channel selection and preflight checks before sending.</summary>
 */
export class EmailValidationResultRepository extends TenantAwareRepository<
  typeof emailValidationResults,
  EmailValidationResult,
  NewEmailValidationResult
> {
  constructor() {
    super(emailValidationResults);
  }

  async findByEmailForTenant(
    tenantId: string,
    email: string
  ): Promise<EmailValidationResult | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.email, email)))
      .orderBy(desc(this.table.checkedAt))
      .limit(1);
    return results[0];
  }
}
