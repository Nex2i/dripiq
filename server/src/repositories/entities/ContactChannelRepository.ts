import { and, eq, inArray } from 'drizzle-orm';
import { contactChannels, ContactChannel, NewContactChannel } from '@/db/schema';
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

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewContactChannel, 'tenantId'>
  ): Promise<ContactChannel> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as ContactChannel;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewContactChannel, 'tenantId'>[]
  ): Promise<ContactChannel[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as ContactChannel[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<ContactChannel | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<ContactChannel[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as ContactChannel[];
  }

  async findAllForTenant(tenantId: string): Promise<ContactChannel[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as ContactChannel[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewContactChannel, 'tenantId'>>
  ): Promise<ContactChannel | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ContactChannel | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<ContactChannel | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ContactChannel | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<ContactChannel[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as ContactChannel[];
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

  async deleteAllForTenant(tenantId: string): Promise<ContactChannel[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as ContactChannel[];
  }
}
