import { eq, and } from 'drizzle-orm';
import { mailAccounts, MailAccount, NewMailAccount } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';
import { NotFoundError } from '@/exceptions/error';

export type MailAccountWithDetails = MailAccount & {
  user?: { id: string; email: string; name: string | null };
  tenant?: { id: string; name: string };
  oauthTokens?: { id: string; status: string; addedAt: Date }[];
};

/**
 * MailAccountRepository manages connected email provider accounts per user.
 * Handles OAuth connections for Gmail/Microsoft accounts with tenant isolation.
 * Provides lookup for primary accounts and provider-specific operations.
 */
export class MailAccountRepository extends TenantAwareRepository<
  typeof mailAccounts,
  MailAccount,
  NewMailAccount
> {
  constructor() {
    super(mailAccounts);
  }

  /**
   * Find Primary Mail Account By UserId
   */
  async findPrimaryByUserId(userId: string): Promise<MailAccount> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.isPrimary, true)))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`MailAccount not found with userId: ${userId}`);
    }

    return result[0];
  }
}
