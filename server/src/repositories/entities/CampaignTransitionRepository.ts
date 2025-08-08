import { and, eq, desc, inArray } from 'drizzle-orm';
import { campaignTransitions, CampaignTransition, NewCampaignTransition } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>CampaignTransitionRepository records state changes for campaigns.</summary>
 * <summary>Provides a full audit trail of why/when transitions occurred and by whom.</summary>
 * <summary>Drives diagnostics, analytics, and rollback decisions during execution.</summary>
 */
export class CampaignTransitionRepository extends TenantAwareRepository<
  typeof campaignTransitions,
  CampaignTransition,
  NewCampaignTransition
> {
  constructor() {
    super(campaignTransitions);
  }

  // Concrete CRUD
  async create(data: NewCampaignTransition): Promise<CampaignTransition> {
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result as CampaignTransition;
  }

  async createMany(data: NewCampaignTransition[]): Promise<CampaignTransition[]> {
    return (await this.db.insert(this.table).values(data).returning()) as CampaignTransition[];
  }

  async findById(id: string): Promise<CampaignTransition> {
    const results = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!results[0]) throw new NotFoundError(`CampaignTransition not found with id: ${id}`);
    return results[0];
  }

  async findByIds(ids: string[]): Promise<CampaignTransition[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))) as CampaignTransition[];
  }

  async findAll(): Promise<CampaignTransition[]> {
    return (await this.db.select().from(this.table)) as CampaignTransition[];
  }

  async updateById(
    id: string,
    data: Partial<NewCampaignTransition>
  ): Promise<CampaignTransition | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return result as CampaignTransition | undefined;
  }

  async deleteById(id: string): Promise<CampaignTransition | undefined> {
    const [result] = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result as CampaignTransition | undefined;
  }

  async deleteByIds(ids: string[]): Promise<CampaignTransition[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning()) as CampaignTransition[];
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
    data: Omit<NewCampaignTransition, 'tenantId'>
  ): Promise<CampaignTransition> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as CampaignTransition;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewCampaignTransition, 'tenantId'>[]
  ): Promise<CampaignTransition[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as CampaignTransition[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<CampaignTransition | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<CampaignTransition[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as CampaignTransition[];
  }

  async findAllForTenant(tenantId: string): Promise<CampaignTransition[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as CampaignTransition[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewCampaignTransition, 'tenantId'>>
  ): Promise<CampaignTransition | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as CampaignTransition | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<CampaignTransition | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as CampaignTransition | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<CampaignTransition[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as CampaignTransition[];
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

  async deleteAllForTenant(tenantId: string): Promise<CampaignTransition[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as CampaignTransition[];
  }

  // Domain helper
  async listByCampaignForTenant(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignTransition[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)))
      .orderBy(desc(this.table.occurredAt))) as CampaignTransition[];
  }
}
