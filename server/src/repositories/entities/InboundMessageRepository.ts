import { and, eq, desc, inArray } from 'drizzle-orm';
import { inboundMessages, InboundMessage, NewInboundMessage } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>InboundMessageRepository stores replies across channels for analysis.</summary>
 * <summary>Enables threading, sentiment, and smart follow-up automation.</summary>
 * <summary>Correlates inbound replies with campaigns and contacts.</summary>
 */
export class InboundMessageRepository extends TenantAwareRepository<
  typeof inboundMessages,
  InboundMessage,
  NewInboundMessage
> {
  constructor() {
    super(inboundMessages);
  }

  // Concrete CRUD
  async create(data: NewInboundMessage): Promise<InboundMessage> {
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result as InboundMessage;
  }

  async createMany(data: NewInboundMessage[]): Promise<InboundMessage[]> {
    return (await this.db.insert(this.table).values(data).returning()) as InboundMessage[];
  }

  async findById(id: string): Promise<InboundMessage> {
    const results = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!results[0]) throw new NotFoundError(`InboundMessage not found with id: ${id}`);
    return results[0];
  }

  async findByIds(ids: string[]): Promise<InboundMessage[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))) as InboundMessage[];
  }

  async findAll(): Promise<InboundMessage[]> {
    return (await this.db.select().from(this.table)) as InboundMessage[];
  }

  async updateById(
    id: string,
    data: Partial<NewInboundMessage>
  ): Promise<InboundMessage | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return result as InboundMessage | undefined;
  }

  async deleteById(id: string): Promise<InboundMessage | undefined> {
    const [result] = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result as InboundMessage | undefined;
  }

  async deleteByIds(ids: string[]): Promise<InboundMessage[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning()) as InboundMessage[];
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return !!result[0];
  }

  async count(): Promise<number> {
    const result = await this.db.select({ id: this.table.id }).from(this.table);
    return result.length;
  }

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewInboundMessage, 'tenantId'>
  ): Promise<InboundMessage> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as InboundMessage;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewInboundMessage, 'tenantId'>[]
  ): Promise<InboundMessage[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as InboundMessage[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<InboundMessage | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<InboundMessage[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as InboundMessage[];
  }

  async findAllForTenant(tenantId: string): Promise<InboundMessage[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as InboundMessage[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewInboundMessage, 'tenantId'>>
  ): Promise<InboundMessage | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as InboundMessage | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<InboundMessage | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as InboundMessage | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<InboundMessage[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as InboundMessage[];
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

  async deleteAllForTenant(tenantId: string): Promise<InboundMessage[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as InboundMessage[];
  }

  // Domain helper
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
