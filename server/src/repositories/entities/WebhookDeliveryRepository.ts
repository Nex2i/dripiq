import { and, eq, desc, inArray } from 'drizzle-orm';
import { webhookDeliveries, WebhookDelivery, NewWebhookDelivery } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>WebhookDeliveryRepository archives raw inbound webhooks from providers.</summary>
 * <summary>Preserves original payloads for replay, audit, and troubleshooting.</summary>
 * <summary>Feeds normalization into message events and safeguards event processing.</summary>
 */
export class WebhookDeliveryRepository extends TenantAwareRepository<
  typeof webhookDeliveries,
  WebhookDelivery,
  NewWebhookDelivery
> {
  constructor() {
    super(webhookDeliveries);
  }

  // Concrete CRUD
  async create(data: NewWebhookDelivery): Promise<WebhookDelivery> {
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result as WebhookDelivery;
  }

  async createMany(data: NewWebhookDelivery[]): Promise<WebhookDelivery[]> {
    return (await this.db.insert(this.table).values(data).returning()) as WebhookDelivery[];
  }

  async findById(id: string): Promise<WebhookDelivery> {
    const results = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!results[0]) throw new NotFoundError(`WebhookDelivery not found with id: ${id}`);
    return results[0];
  }

  async findByIds(ids: string[]): Promise<WebhookDelivery[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))) as WebhookDelivery[];
  }

  async findAll(): Promise<WebhookDelivery[]> {
    return (await this.db.select().from(this.table)) as WebhookDelivery[];
  }

  async updateById(
    id: string,
    data: Partial<NewWebhookDelivery>
  ): Promise<WebhookDelivery | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return result as WebhookDelivery | undefined;
  }

  async deleteById(id: string): Promise<WebhookDelivery | undefined> {
    const [result] = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result as WebhookDelivery | undefined;
  }

  async deleteByIds(ids: string[]): Promise<WebhookDelivery[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning()) as WebhookDelivery[];
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
    data: Omit<NewWebhookDelivery, 'tenantId'>
  ): Promise<WebhookDelivery> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as WebhookDelivery;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewWebhookDelivery, 'tenantId'>[]
  ): Promise<WebhookDelivery[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as WebhookDelivery[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<WebhookDelivery | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<WebhookDelivery[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as WebhookDelivery[];
  }

  async findAllForTenant(tenantId: string): Promise<WebhookDelivery[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as WebhookDelivery[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewWebhookDelivery, 'tenantId'>>
  ): Promise<WebhookDelivery | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as WebhookDelivery | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<WebhookDelivery | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as WebhookDelivery | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<WebhookDelivery[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as WebhookDelivery[];
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

  async deleteAllForTenant(tenantId: string): Promise<WebhookDelivery[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as WebhookDelivery[];
  }

  // Domain helper
  async listByProviderForTenant(
    tenantId: string,
    provider: string,
    limit = 100
  ): Promise<WebhookDelivery[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.provider, provider)))
      .orderBy(desc(this.table.receivedAt))
      .limit(limit)) as WebhookDelivery[];
  }
}
