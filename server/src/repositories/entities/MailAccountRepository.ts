import { eq, and } from 'drizzle-orm';
import { mailAccounts, MailAccount, NewMailAccount } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { logger } from '@/libs/logger';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

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

  async create(mailAccount: NewMailAccount): Promise<MailAccount> {
    try {
      // Check if user already has any mail accounts
      const existingAccounts = await this.findAccountsByUserId(mailAccount.userId);

      // Set isPrimary to true for first account, false for subsequent ones
      const accountToCreate = {
        ...mailAccount,
        isPrimary: existingAccounts.length === 0,
      };

      const result = await this.db.insert(this.table).values(accountToCreate).returning();
      return result[0] as MailAccount;
    } catch (error) {
      logger.error('Failed to create mail account', {
        error: error instanceof Error ? error.message : 'Unknown error',
        mailAccount,
      });
      throw error;
    }
  }

  async findAccountsByUserId(userId: string): Promise<MailAccount[]> {
    const results = await this.db.select().from(this.table).where(eq(this.table.userId, userId));
    return results;
  }

  /**
   * Switch primary provider for a user
   * Sets the specified provider as primary and all others as non-primary
   */
  async switchPrimaryProvider(userId: string, providerId: string): Promise<MailAccount> {
    try {
      // Start a transaction to ensure atomicity
      const result = await this.db.transaction(async (tx) => {
        // First, set all user's mail accounts to non-primary
        await tx
          .update(this.table)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(this.table.userId, userId));

        // Then, set the specified account as primary
        const updatedAccount = await tx
          .update(this.table)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(and(eq(this.table.userId, userId), eq(this.table.id, providerId)))
          .returning();

        if (!updatedAccount || updatedAccount.length === 0) {
          throw new NotFoundError(
            `Mail account not found with id: ${providerId} for user: ${userId}`
          );
        }

        return updatedAccount[0];
      });

      return result as MailAccount;
    } catch (error) {
      logger.error('Failed to switch primary provider', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        providerId,
      });
      throw error;
    }
  }
}
