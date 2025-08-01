import { eq, inArray } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import * as schema from '@/db/schema';

export abstract class BaseRepository<TTable extends PgTable, TSelect = any, TInsert = any> {
  protected db: PostgresJsDatabase<typeof schema>;
  protected table: TTable;

  constructor(table: TTable) {
    this.db = db;
    this.table = table;
  }

  /**
   * Create a single record
   */
  async create(data: TInsert): Promise<TSelect> {
    const [result] = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();
    return result as TSelect;
  }

  /**
   * Create multiple records
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    return (await this.db
      .insert(this.table)
      .values(data as any)
      .returning()) as TSelect[];
  }

  /**
   * Find record by ID
   */
  async findById(id: string): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1);
    return results[0] as TSelect | undefined;
  }

  /**
   * Find records by IDs
   */
  async findByIds(ids: string[]): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray((this.table as any).id, ids))) as TSelect[];
  }

  /**
   * Find all records
   */
  async findAll(): Promise<TSelect[]> {
    return (await this.db.select().from(this.table)) as TSelect[];
  }

  /**
   * Update record by ID
   */
  async updateById(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq((this.table as any).id, id))
      .returning();
    return result as TSelect | undefined;
  }

  /**
   * Delete record by ID
   */
  async deleteById(id: string): Promise<TSelect | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(eq((this.table as any).id, id))
      .returning();
    return result as TSelect | undefined;
  }

  /**
   * Delete records by IDs
   */
  async deleteByIds(ids: string[]): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray((this.table as any).id, ids))
      .returning()) as TSelect[];
  }

  /**
   * Check if record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.findById(id);
    return !!result;
  }

  /**
   * Count all records
   */
  async count(): Promise<number> {
    const result = await this.db.select().from(this.table);
    return result.length;
  }
}
