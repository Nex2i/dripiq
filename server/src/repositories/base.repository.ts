import { PgDatabase } from 'drizzle-orm/pg-core';
import { db } from '@/db';

/**
 * Base repository interface that all repositories should implement
 * Provides common database operations and access patterns
 */
export abstract class BaseRepository {
  protected db: PgDatabase<any>;

  constructor() {
    this.db = db;
  }

  /**
   * Base error handling for database operations
   */
  protected handleError(error: any, operation: string): never {
    console.error(`Repository error during ${operation}:`, error);
    throw error;
  }
}

/**
 * Common repository operations interface
 */
export interface IRepository<T, TInsert> {
  findById(id: string): Promise<T | null>;
  create(data: TInsert): Promise<T>;
  update(id: string, data: Partial<TInsert>): Promise<T>;
  delete(id: string): Promise<T>;
}