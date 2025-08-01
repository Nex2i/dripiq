import { db } from '@/db';
import { eq, and, inArray } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';

export abstract class BaseRepository<
  TTable extends PgTableWithColumns<TableConfig>,
  TSelect = TTable['$inferSelect'],
  TInsert = TTable['$inferInsert']
> {
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
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result!;
  }

  /**
   * Create multiple records
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    return await this.db.insert(this.table).values(data).returning();
  }

  /**
   * Find record by ID
   */
  async findById(id: string): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return results[0];
  }

  /**
   * Find records by IDs
   */
  async findByIds(ids: string[]): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids));
  }

  /**
   * Find all records
   */
  async findAll(): Promise<TSelect[]> {
    return await this.db.select().from(this.table);
  }

  /**
   * Update record by ID
   */
  async updateById(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    return result;
  }

  /**
   * Delete record by ID
   */
  async deleteById(id: string): Promise<TSelect | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning();
    return result;
  }

  /**
   * Delete records by IDs
   */
  async deleteByIds(ids: string[]): Promise<TSelect[]> {
    if (ids.length === 0) return [];
    return await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning();
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