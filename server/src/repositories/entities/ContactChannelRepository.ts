import { and, eq } from 'drizzle-orm';
import { contactChannels, ContactChannel, NewContactChannel, channelEnum } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>ContactChannelRepository manages multiple addresses per contact across channels.</summary>
 * <summary>Resolves primary/verified addresses for routing messages and replies.</summary>
 * <summary>Integrates with validation results to ensure quality and deliverability.</summary>
 */
export class ContactChannelRepository extends TenantAwareRepository<
  typeof contactChannels,
  ContactChannel,
  NewContactChannel
> {
  constructor() {
    super(contactChannels);
  }

  async findPrimaryForTenant(
    tenantId: string,
    contactId: string,
    type: (typeof channelEnum)['enumValues'][number]
  ): Promise<ContactChannel | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.contactId, contactId),
          eq(this.table.type, type),
          eq(this.table.isPrimary, true)
        )
      )
      .limit(1);
    return results[0];
  }
}
