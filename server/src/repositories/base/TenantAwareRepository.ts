import { eq, and, inArray } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { BaseRepository } from './BaseRepository';
import { logger } from '@/libs/logger';

export abstract class TenantAwareRepository<
  TTable extends PgTable,
  TSelect = any,
  TInsert = any,
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
  async createManyForTenant(
    tenantId: string,
    data: Omit<TInsert, 'tenantId'>[]
  ): Promise<TSelect[]> {
    const dataWithTenant = data.map((item) => ({ ...item, tenantId })) as TInsert[];
    return await this.createMany(dataWithTenant);
  }

  /**
   * Find record by ID with tenant validation
   */
  async findByIdForTenant(id: string, tenantId: string): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq((this.table as any).id, id), eq((this.table as any).tenantId, tenantId)))
      .limit(1);
    return results[0] as TSelect | undefined;
  }

  /**
   * Find records by IDs with tenant validation
   */
  async findByIdsForTenant(ids: string[], tenantId: string): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray((this.table as any).id, ids), eq((this.table as any).tenantId, tenantId))
      )) as TSelect[];
  }

  /**
   * Find all records for a tenant
   */
  async findAllForTenant(tenantId: string): Promise<TSelect[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as any).tenantId, tenantId))) as TSelect[];
  }

  /**
   * Update record by ID with tenant validation
   */
  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<TInsert, 'tenantId'>>
  ): Promise<TSelect | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq((this.table as any).id, id), eq((this.table as any).tenantId, tenantId)))
      .returning();
    return result as TSelect | undefined;
  }

  /**
   * Delete record by ID with tenant validation
   */
  async deleteByIdForTenant(id: string, tenantId: string): Promise<TSelect | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq((this.table as any).id, id), eq((this.table as any).tenantId, tenantId)))
      .returning();
    return result as TSelect | undefined;
  }

  /**
   * Delete records by IDs with tenant validation
   */
  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray((this.table as any).id, ids), eq((this.table as any).tenantId, tenantId)))
      .returning()) as TSelect[];
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
    return (await this.db
      .delete(this.table)
      .where(eq((this.table as any).tenantId, tenantId))
      .returning()) as TSelect[];
  }

  // Override base methods with implementations that work but include security warnings
  // Note: These methods bypass tenant validation - use tenant-aware methods when possible
  async create(data: TInsert): Promise<TSelect> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using create() without tenant validation. Consider using createForTenant() instead.'
    );
    return await super.create(data);
  }

  async createMany(data: TInsert[]): Promise<TSelect[]> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using createMany() without tenant validation. Consider using createManyForTenant() instead.'
    );
    return await super.createMany(data);
  }

  async findById(id: string): Promise<TSelect> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using findById() without tenant validation. Consider using findByIdForTenant() instead.'
    );
    return await super.findById(id);
  }

  async findByIds(ids: string[]): Promise<TSelect[]> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using findByIds() without tenant validation. Consider using findByIdsForTenant() instead.'
    );
    return await super.findByIds(ids);
  }

  async findAll(): Promise<TSelect[]> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using findAll() without tenant validation. Consider using findAllForTenant() instead.'
    );
    return await super.findAll();
  }

  async updateById(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using updateById() without tenant validation. Consider using updateByIdForTenant() instead.'
    );
    return await super.updateById(id, data);
  }

  async deleteById(id: string): Promise<TSelect | undefined> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using deleteById() without tenant validation. Consider using deleteByIdForTenant() instead.'
    );
    return await super.deleteById(id);
  }

  async deleteByIds(ids: string[]): Promise<TSelect[]> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using deleteByIds() without tenant validation. Consider using deleteByIdsForTenant() instead.'
    );
    return await super.deleteByIds(ids);
  }

  async exists(id: string): Promise<boolean> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using exists() without tenant validation. Consider using existsForTenant() instead.'
    );
    return await super.exists(id);
  }

  async count(): Promise<number> {
    logger.warn(
      '⚠️  SECURITY WARNING: Using count() without tenant validation. Consider using countForTenant() instead.'
    );
    return await super.count();
  }
}
