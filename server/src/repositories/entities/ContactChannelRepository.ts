import { and, eq } from 'drizzle-orm';
import { contactChannels, ContactChannel, NewContactChannel, channelEnum } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

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