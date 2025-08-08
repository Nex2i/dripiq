import { and, eq, desc, inArray } from 'drizzle-orm';
import { campaignPlanVersions, CampaignPlanVersion, NewCampaignPlanVersion } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>CampaignPlanVersionRepository tracks immutable versions of campaign plans.</summary>
 * <summary>Enables auditable change history and reproducible execution across plan iterations.</summary>
 * <summary>Used to resolve the concrete graph used by a campaign at any point in time.</summary>
 */
export class CampaignPlanVersionRepository extends TenantAwareRepository<
  typeof campaignPlanVersions,
  CampaignPlanVersion,
  NewCampaignPlanVersion
> {
  constructor() {
    super(campaignPlanVersions);
  }

  // Concrete CRUD (non-tenant-aware)
  async create(data: NewCampaignPlanVersion): Promise<CampaignPlanVersion> {
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result as CampaignPlanVersion;
  }

  async createMany(data: NewCampaignPlanVersion[]): Promise<CampaignPlanVersion[]> {
    return (await this.db.insert(this.table).values(data).returning()) as CampaignPlanVersion[];
  }

  async findById(id: string): Promise<CampaignPlanVersion> {
    const results = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!results[0]) throw new NotFoundError(`CampaignPlanVersion not found with id: ${id}`);
    return results[0];
  }

  async findByIds(ids: string[]): Promise<CampaignPlanVersion[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))) as CampaignPlanVersion[];
  }

  async findAll(): Promise<CampaignPlanVersion[]> {
    return (await this.db.select().from(this.table)) as CampaignPlanVersion[];
  }

  async updateById(
    id: string,
    data: Partial<NewCampaignPlanVersion>
  ): Promise<CampaignPlanVersion | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return result as CampaignPlanVersion | undefined;
  }

  async deleteById(id: string): Promise<CampaignPlanVersion | undefined> {
    const [result] = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result as CampaignPlanVersion | undefined;
  }

  async deleteByIds(ids: string[]): Promise<CampaignPlanVersion[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning()) as CampaignPlanVersion[];
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

  // Concrete tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewCampaignPlanVersion, 'tenantId'>
  ): Promise<CampaignPlanVersion> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as CampaignPlanVersion;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewCampaignPlanVersion, 'tenantId'>[]
  ): Promise<CampaignPlanVersion[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as CampaignPlanVersion[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<CampaignPlanVersion | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<CampaignPlanVersion[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as CampaignPlanVersion[];
  }

  async findAllForTenant(tenantId: string): Promise<CampaignPlanVersion[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as CampaignPlanVersion[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewCampaignPlanVersion, 'tenantId'>>
  ): Promise<CampaignPlanVersion | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as CampaignPlanVersion | undefined;
  }

  async deleteByIdForTenant(
    id: string,
    tenantId: string
  ): Promise<CampaignPlanVersion | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as CampaignPlanVersion | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<CampaignPlanVersion[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as CampaignPlanVersion[];
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

  async deleteAllForTenant(tenantId: string): Promise<CampaignPlanVersion[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as CampaignPlanVersion[];
  }

  // Domain helpers
  async findByCampaignAndVersionForTenant(
    tenantId: string,
    campaignId: string,
    version: string
  ): Promise<CampaignPlanVersion | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.campaignId, campaignId),
          eq(this.table.version, version)
        )
      )
      .limit(1);
    return results[0];
  }

  async listByCampaignForTenant(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignPlanVersion[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)))
      .orderBy(desc(this.table.createdAt));
  }
}
