import { and, eq, desc } from 'drizzle-orm';
import { inboundMessages, InboundMessage, NewInboundMessage, channelEnum } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class InboundMessageRepository extends TenantAwareRepository<
  typeof inboundMessages,
  InboundMessage,
  NewInboundMessage
> {
  constructor() {
    super(inboundMessages);
  }

  async listByCampaignForTenant(
    tenantId: string,
    campaignId: string,
    limit = 100
  ): Promise<InboundMessage[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)))
      .orderBy(desc(this.table.receivedAt))
      .limit(limit)) as InboundMessage[];
  }
}