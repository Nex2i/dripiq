import { and, eq, desc } from 'drizzle-orm';
import {
  outboundMessages,
  OutboundMessage,
  NewOutboundMessage,
  outboundMessageStateEnum,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>OutboundMessageRepository is the outbox for all scheduled and sent messages.</summary>
 * <summary>Supports idempotency via dedupe keys and lookup by campaign/state.</summary>
 * <summary>Feeds provider dispatch and correlates downstream events by message id.</summary>
 */
export class OutboundMessageRepository extends TenantAwareRepository<
  typeof outboundMessages,
  OutboundMessage,
  NewOutboundMessage
> {
  constructor() {
    super(outboundMessages);
  }

  async findByDedupeKeyForTenant(
    tenantId: string,
    dedupeKey: string
  ): Promise<OutboundMessage | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.dedupeKey, dedupeKey)))
      .limit(1);
    return results[0];
  }

  async listByCampaignForTenant(tenantId: string, campaignId: string): Promise<OutboundMessage[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)))
      .orderBy(desc(this.table.createdAt));
  }

  async listByStateForTenant(
    tenantId: string,
    state: (typeof outboundMessageStateEnum)['enumValues'][number]
  ): Promise<OutboundMessage[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.state, state)))
      .orderBy(desc(this.table.createdAt));
  }
}
