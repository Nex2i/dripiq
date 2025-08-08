import { eq, and } from 'drizzle-orm';
import { emailSenderIdentities, EmailSenderIdentity, NewEmailSenderIdentity } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>EmailSenderIdentityRepository manages AE sender identities used to send outbound emails.</summary>
 * <summary>Provides lookup for default identity and by from_email per tenant, enabling compliant sending.</summary>
 * <summary>Forms the foundation for channel-specific delivery configuration across campaigns.</summary>
 */
export class EmailSenderIdentityRepository extends TenantAwareRepository<
  typeof emailSenderIdentities,
  EmailSenderIdentity,
  NewEmailSenderIdentity
> {
  constructor() {
    super(emailSenderIdentities);
  }

  async findDefaultForTenant(tenantId: string): Promise<EmailSenderIdentity | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.isDefault, true)))
      .limit(1);
    return results[0];
  }

  async findByFromEmailForTenant(
    tenantId: string,
    fromEmail: string
  ): Promise<EmailSenderIdentity | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.fromEmail, fromEmail)))
      .limit(1);
    return results[0];
  }
}
