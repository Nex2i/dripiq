import { PgDatabase } from 'drizzle-orm/pg-core';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { userTenants } from '@/db/schema';

/**
 * Base repository interface that all repositories should implement
 * Provides common database operations and access patterns with tenant isolation
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

  /**
   * Validates that a user has access to a specific tenant
   * Should be called before any tenant-scoped operations
   */
  protected async validateUserTenantAccess(userId: string, tenantId: string): Promise<void> {
    try {
      const userTenant = await this.db
        .select({ id: userTenants.id })
        .from(userTenants)
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      if (userTenant.length === 0) {
        throw new Error(`Access denied: User ${userId} does not have access to tenant ${tenantId}`);
      }
    } catch (error) {
      this.handleError(error, 'validateUserTenantAccess');
    }
  }
}

/**
 * Common repository operations interface with tenant-aware operations
 */
export interface IRepository<T, TInsert> {
  findById(id: string, tenantId: string, userId?: string): Promise<T | null>;
  create(data: TInsert, tenantId: string, userId?: string): Promise<T>;
  update(id: string, data: Partial<TInsert>, tenantId: string, userId?: string): Promise<T>;
  delete(id: string, tenantId: string, userId?: string): Promise<T>;
}

/**
 * Interface for tenant-scoped repositories
 */
export interface ITenantScopedRepository<T, TInsert> extends IRepository<T, TInsert> {
  findByTenant(tenantId: string, userId?: string): Promise<T[]>;
}