import { and, eq, inArray } from 'drizzle-orm';
import {
  communicationSuppressions,
  CommunicationSuppression,
  NewCommunicationSuppression,
  channelEnum,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>CommunicationSuppressionRepository enforces per-tenant suppression lists.</summary>
 * <summary>Prevents messaging suppressed addresses and tracks reasons/expiry.</summary>
 * <summary>Consulted before dispatch to ensure compliance and respect preferences.</summary>
 */
export class CommunicationSuppressionRepository extends TenantAwareRepository<
  typeof communicationSuppressions,
  CommunicationSuppression,
  NewCommunicationSuppression
> {
  constructor() {
    super(communicationSuppressions);
  }

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewCommunicationSuppression, 'tenantId'>
  ): Promise<CommunicationSuppression> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as CommunicationSuppression;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewCommunicationSuppression, 'tenantId'>[]
  ): Promise<CommunicationSuppression[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db
      .insert(this.table)
      .values(values)
      .returning()) as CommunicationSuppression[];
  }

  async findByIdForTenant(
    id: string,
    tenantId: string
  ): Promise<CommunicationSuppression | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<CommunicationSuppression[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as CommunicationSuppression[];
  }

  async findAllForTenant(tenantId: string): Promise<CommunicationSuppression[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as CommunicationSuppression[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewCommunicationSuppression, 'tenantId'>>
  ): Promise<CommunicationSuppression | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as CommunicationSuppression | undefined;
  }

  async deleteByIdForTenant(
    id: string,
    tenantId: string
  ): Promise<CommunicationSuppression | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as CommunicationSuppression | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<CommunicationSuppression[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as CommunicationSuppression[];
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

  async deleteAllForTenant(tenantId: string): Promise<CommunicationSuppression[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as CommunicationSuppression[];
  }

  // Domain helper
  async isSuppressed(
    tenantId: string,
    channel: (typeof channelEnum)['enumValues'][number],
    address: string
  ): Promise<boolean> {
    const results = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.channel, channel),
          eq(this.table.address, address)
        )
      )
      .limit(1);
    return !!results[0];
  }
}
