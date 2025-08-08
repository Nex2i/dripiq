import { and, eq, desc } from 'drizzle-orm';
import {
  contactCampaigns,
  ContactCampaign,
  NewContactCampaign,
  channelEnum,
  campaignStatusEnum,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class ContactCampaignRepository extends TenantAwareRepository<
  typeof contactCampaigns,
  ContactCampaign,
  NewContactCampaign
> {
  constructor() {
    super(contactCampaigns);
  }

  async findByContactAndChannelForTenant(
    tenantId: string,
    contactId: string,
    channel: (typeof channelEnum)['enumValues'][number]
  ): Promise<ContactCampaign | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.contactId, contactId),
          eq(this.table.channel, channel)
        )
      )
      .limit(1);
    return results[0];
  }

  async listByStatusForTenant(
    tenantId: string,
    status: (typeof campaignStatusEnum)['enumValues'][number],
    limit?: number
  ): Promise<ContactCampaign[]> {
    let query = this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.status, status)))
      .orderBy(desc(this.table.updatedAt));

    if (limit) {
      (query as any) = (query as any).limit(limit);
    }

    return await (query as any);
  }
}
