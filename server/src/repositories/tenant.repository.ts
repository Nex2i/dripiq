import { eq } from 'drizzle-orm';
import { tenants, userTenants, users, Tenant, NewTenant, UserTenant, User } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export interface TenantWithUsers extends Tenant {
  users: (UserTenant & {
    user: User;
  })[];
}

export class TenantRepository extends BaseRepository implements IRepository<Tenant, NewTenant> {
  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    try {
      const result = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Find tenant by name
   */
  async findByName(name: string): Promise<Tenant | null> {
    try {
      const result = await this.db.select().from(tenants).where(eq(tenants.name, name)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByName');
    }
  }

  /**
   * Create a new tenant
   */
  async create(tenantData: NewTenant): Promise<Tenant> {
    try {
      const [tenant] = await this.db.insert(tenants).values(tenantData).returning();
      if (!tenant) {
        throw new Error('Failed to create tenant');
      }
      return tenant;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update tenant
   */
  async update(id: string, updateData: Partial<NewTenant>): Promise<Tenant> {
    try {
      const [tenant] = await this.db
        .update(tenants)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      if (!tenant) {
        throw new Error('Tenant not found');
      }
      return tenant;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete tenant
   */
  async delete(id: string): Promise<Tenant> {
    try {
      const [tenant] = await this.db.delete(tenants).where(eq(tenants.id, id)).returning();
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      return tenant;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Get tenant with users
   */
  async findByIdWithUsers(id: string): Promise<TenantWithUsers> {
    try {
      const tenant = await this.findById(id);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Get users for this tenant
      const tenantUsers = await this.db
        .select()
        .from(userTenants)
        .innerJoin(users, eq(userTenants.userId, users.id))
        .where(eq(userTenants.tenantId, id));

      return {
        ...tenant,
        users: tenantUsers.map((row) => ({
          ...row.user_tenants,
          user: row.users,
        })),
      };
    } catch (error) {
      this.handleError(error, 'findByIdWithUsers');
    }
  }

  /**
   * Get all tenants
   */
  async findAll(): Promise<Tenant[]> {
    try {
      return await this.db.select().from(tenants);
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  /**
   * Find tenants by user ID
   */
  async findByUserId(userId: string): Promise<Tenant[]> {
    try {
      const result = await this.db
        .select({ tenant: tenants })
        .from(tenants)
        .innerJoin(userTenants, eq(tenants.id, userTenants.tenantId))
        .where(eq(userTenants.userId, userId));

      return result.map(row => row.tenant);
    } catch (error) {
      this.handleError(error, 'findByUserId');
    }
  }

  /**
   * Check if tenant exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'exists');
    }
  }
}