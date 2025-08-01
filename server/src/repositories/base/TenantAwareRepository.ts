import { eq, and, inArray } from 'drizzle-orm';
import { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { BaseRepository } from './BaseRepository';

export abstract class TenantAwareRepository<
  TTable extends PgTableWithColumns<TableConfig>,
  TSelect = TTable['$inferSelect'],
  TInsert = TTable['$inferInsert']
> extends BaseRepository<TTable, TSelect, TInsert> {
  
  /**
   * Create a record with tenant validation
   */
  async createForTenant(tenantId: string, data: Omit<TInsert, 'tenantId'>): Promise<TSelect> {
    const dataWithTenant = { ...data, tenantId } as TInsert;
    return await this.create(dataWithTenant);
  }

  /**
   * Create multiple records with tenant validation
   */
  async createManyForTenant(tenantId: string, data: Omit<TInsert, 'tenantId'>[]): Promise<TSelect[]> {
    const dataWithTenant = data.map(item => ({ ...item, tenantId })) as TInsert[];
    return await this.createMany(dataWithTenant);
  }

  /**
   * Find record by ID with tenant validation
   */
  async findByIdForTenant(id: string, tenantId: string): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  /**
   * Find records by IDs with tenant validation
   */
  async findByIdsForTenant(ids: string[], tenantId: string): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return await this.db
      .select()
      .from(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)));
  }

  /**
   * Find all records for a tenant
   */
  async findAllForTenant(tenantId: string): Promise<TSelect[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId));
  }

  /**
   * Update record by ID with tenant validation
   */
  async updateByIdForTenant(id: string, tenantId: string, data: Partial<Omit<TInsert, 'tenantId'>>): Promise<TSelect | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result;
  }

  /**
   * Delete record by ID with tenant validation
   */
  async deleteByIdForTenant(id: string, tenantId: string): Promise<TSelect | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result;
  }

  /**
   * Delete records by IDs with tenant validation
   */
  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning();
  }

  /**
   * Check if record exists by ID with tenant validation
   */
  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.findByIdForTenant(id, tenantId);
    return !!result;
  }

  /**
   * Count records for a tenant
   */
  async countForTenant(tenantId: string): Promise<number> {
    const result = await this.findAllForTenant(tenantId);
    return result.length;
  }

  /**
   * Delete all records for a tenant (used for tenant cleanup)
   */
  async deleteAllForTenant(tenantId: string): Promise<TSelect[]> {
    return await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning();
  }

  // Override base methods to prevent accidental usage without tenant validation
  async create(): Promise<TSelect> {
    throw new Error('Use createForTenant instead. Direct create is not allowed for tenant-aware repositories.');
  }

  async createMany(): Promise<TSelect[]> {
    throw new Error('Use createManyForTenant instead. Direct createMany is not allowed for tenant-aware repositories.');
  }

  async findById(): Promise<TSelect | undefined> {
    throw new Error('Use findByIdForTenant instead. Direct findById is not allowed for tenant-aware repositories.');
  }

  async findByIds(): Promise<TSelect[]> {
    throw new Error('Use findByIdsForTenant instead. Direct findByIds is not allowed for tenant-aware repositories.');
  }

  async findAll(): Promise<TSelect[]> {
    throw new Error('Use findAllForTenant instead. Direct findAll is not allowed for tenant-aware repositories.');
  }

  async updateById(): Promise<TSelect | undefined> {
    throw new Error('Use updateByIdForTenant instead. Direct updateById is not allowed for tenant-aware repositories.');
  }

  async deleteById(): Promise<TSelect | undefined> {
    throw new Error('Use deleteByIdForTenant instead. Direct deleteById is not allowed for tenant-aware repositories.');
  }

  async deleteByIds(): Promise<TSelect[]> {
    throw new Error('Use deleteByIdsForTenant instead. Direct deleteByIds is not allowed for tenant-aware repositories.');
  }

  async exists(): Promise<boolean> {
    throw new Error('Use existsForTenant instead. Direct exists is not allowed for tenant-aware repositories.');
  }

  async count(): Promise<number> {
    throw new Error('Use countForTenant instead. Direct count is not allowed for tenant-aware repositories.');
  }
}