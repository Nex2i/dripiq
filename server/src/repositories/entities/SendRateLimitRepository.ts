import { and, eq, inArray } from 'drizzle-orm';
import { sendRateLimits, SendRateLimit, NewSendRateLimit, channelEnum } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>SendRateLimitRepository stores throttle policies by tenant, channel, and identity.</summary>
 * <summary>Allows workers to compute available capacity within sliding windows.</summary>
 * <summary>Guards providers from overload and aligns with provider-specific quotas.</summary>
 */
export class SendRateLimitRepository extends TenantAwareRepository<
  typeof sendRateLimits,
  SendRateLimit,
  NewSendRateLimit
> {
  constructor() {
    super(sendRateLimits);
  }

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewSendRateLimit, 'tenantId'>
  ): Promise<SendRateLimit> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as Omit<NewSendRateLimit, 'tenantId'>), tenantId } as NewSendRateLimit)
      .returning();
    return result as SendRateLimit;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewSendRateLimit, 'tenantId'>[]
  ): Promise<SendRateLimit[]> {
    const values: NewSendRateLimit[] = data.map(
      (d) => ({ ...(d as Omit<NewSendRateLimit, 'tenantId'>), tenantId }) as NewSendRateLimit
    );
    return (await this.db.insert(this.table).values(values).returning()) as SendRateLimit[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<SendRateLimit | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<SendRateLimit[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as SendRateLimit[];
  }

  async findAllForTenant(tenantId: string): Promise<SendRateLimit[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as SendRateLimit[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewSendRateLimit, 'tenantId'>>
  ): Promise<SendRateLimit | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as Partial<Omit<NewSendRateLimit, 'tenantId'>> as Partial<NewSendRateLimit>)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as SendRateLimit | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<SendRateLimit | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as SendRateLimit | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<SendRateLimit[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as SendRateLimit[];
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

  async deleteAllForTenant(tenantId: string): Promise<SendRateLimit[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as SendRateLimit[];
  }

  // Domain helper
  async getTenantLimit(
    tenantId: string,
    channel: (typeof channelEnum)['enumValues'][number]
  ): Promise<SendRateLimit | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.channel, channel)))
      .limit(1);
    return results[0];
  }
}
