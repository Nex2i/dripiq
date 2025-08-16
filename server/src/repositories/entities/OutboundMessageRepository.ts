import { and, eq, desc, inArray } from 'drizzle-orm';
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

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewOutboundMessage, 'tenantId'>
  ): Promise<OutboundMessage> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as Omit<NewOutboundMessage, 'tenantId'>), tenantId } as NewOutboundMessage)
      .returning();
    return result as OutboundMessage;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewOutboundMessage, 'tenantId'>[]
  ): Promise<OutboundMessage[]> {
    const values: NewOutboundMessage[] = data.map(
      (d) => ({ ...(d as Omit<NewOutboundMessage, 'tenantId'>), tenantId }) as NewOutboundMessage
    );
    return (await this.db.insert(this.table).values(values).returning()) as OutboundMessage[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<OutboundMessage | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<OutboundMessage[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as OutboundMessage[];
  }

  async findAllForTenant(tenantId: string): Promise<OutboundMessage[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as OutboundMessage[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewOutboundMessage, 'tenantId'>>
  ): Promise<OutboundMessage | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as Partial<Omit<NewOutboundMessage, 'tenantId'>> as Partial<NewOutboundMessage>)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as OutboundMessage | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<OutboundMessage | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as OutboundMessage | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<OutboundMessage[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as OutboundMessage[];
  }

  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return !!result[0];
  }

  async countForTenant(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId));
    return result.length;
  }

  async deleteAllForTenant(tenantId: string): Promise<OutboundMessage[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as OutboundMessage[];
  }

  // Domain helpers
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

  // TODO: Add these methods when campaign execution is activated
  /*
  async countByCampaignForTenant(tenantId: string, campaignId: string): Promise<number> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.campaignId, campaignId)
        )
      );
    return result.length;
  }

  async findByProviderMessageIdForTenant(
    tenantId: string,
    providerMessageId: string
  ): Promise<OutboundMessage | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.providerMessageId, providerMessageId)
        )
      )
      .limit(1);
    return results[0];
  }
  */
}
