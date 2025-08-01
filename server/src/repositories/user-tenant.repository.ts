import { eq, and } from 'drizzle-orm';
import { userTenants, users, tenants, roles, UserTenant, NewUserTenant, User, Tenant, Role } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export interface UserTenantWithDetails extends UserTenant {
  user: User;
  tenant: Tenant;
  role: Role;
}

export class UserTenantRepository extends BaseRepository implements IRepository<UserTenant, NewUserTenant> {
  /**
   * Find user-tenant relationship by ID
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<UserTenant | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(userTenants)
        .where(and(eq(userTenants.id, id), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new user-tenant relationship
   */
  async create(data: NewUserTenant, tenantId: string, userId?: string): Promise<UserTenant> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Ensure tenantId matches
      const dataWithTenant = { ...data, tenantId };

      const [userTenant] = await this.db.insert(userTenants).values(dataWithTenant).returning();
      if (!userTenant) {
        throw new Error('Failed to create user-tenant relationship');
      }
      return userTenant;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update user-tenant relationship
   */
  async update(id: string, updateData: Partial<NewUserTenant>, tenantId: string, userId?: string): Promise<UserTenant> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [userTenant] = await this.db
        .update(userTenants)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(userTenants.id, id), eq(userTenants.tenantId, tenantId)))
        .returning();

      if (!userTenant) {
        throw new Error('User-tenant relationship not found or access denied');
      }
      return userTenant;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete user-tenant relationship
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<UserTenant> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [userTenant] = await this.db
        .delete(userTenants)
        .where(and(eq(userTenants.id, id), eq(userTenants.tenantId, tenantId)))
        .returning();

      if (!userTenant) {
        throw new Error('User-tenant relationship not found or access denied');
      }
      return userTenant;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find user-tenant relationship by user and tenant IDs
   */
  async findByUserAndTenant(userId: string, tenantId: string): Promise<UserTenant | null> {
    try {
      const result = await this.db
        .select()
        .from(userTenants)
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByUserAndTenant');
    }
  }

  /**
   * Find all user-tenant relationships for a tenant
   */
  async findByTenant(tenantId: string, requestingUserId?: string): Promise<UserTenant[]> {
    try {
      if (requestingUserId) {
        await this.validateUserTenantAccess(requestingUserId, tenantId);
      }

      return await this.db
        .select()
        .from(userTenants)
        .where(eq(userTenants.tenantId, tenantId));
    } catch (error) {
      this.handleError(error, 'findByTenant');
    }
  }

  /**
   * Find all user-tenant relationships for a user
   */
  async findByUser(userId: string): Promise<UserTenant[]> {
    try {
      return await this.db
        .select()
        .from(userTenants)
        .where(eq(userTenants.userId, userId));
    } catch (error) {
      this.handleError(error, 'findByUser');
    }
  }

  /**
   * Find user-tenant relationship with full details
   */
  async findByIdWithDetails(id: string, tenantId: string, userId?: string): Promise<UserTenantWithDetails | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(userTenants)
        .innerJoin(users, eq(userTenants.userId, users.id))
        .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
        .innerJoin(roles, eq(userTenants.roleId, roles.id))
        .where(and(eq(userTenants.id, id), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      if (!result[0]) {
        return null;
      }

      const row = result[0];
      return {
        ...row.user_tenants,
        user: row.users,
        tenant: row.tenants,
        role: row.roles,
      };
    } catch (error) {
      this.handleError(error, 'findByIdWithDetails');
    }
  }

  /**
   * Find all user-tenant relationships for a tenant with details
   */
  async findByTenantWithDetails(tenantId: string, requestingUserId?: string): Promise<UserTenantWithDetails[]> {
    try {
      if (requestingUserId) {
        await this.validateUserTenantAccess(requestingUserId, tenantId);
      }

      const result = await this.db
        .select()
        .from(userTenants)
        .innerJoin(users, eq(userTenants.userId, users.id))
        .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
        .innerJoin(roles, eq(userTenants.roleId, roles.id))
        .where(eq(userTenants.tenantId, tenantId));

      return result.map((row) => ({
        ...row.user_tenants,
        user: row.users,
        tenant: row.tenants,
        role: row.roles,
      }));
    } catch (error) {
      this.handleError(error, 'findByTenantWithDetails');
    }
  }

  /**
   * Update user status (e.g., from pending to active)
   */
  async updateStatus(userId: string, tenantId: string, status: string, requestingUserId?: string): Promise<UserTenant> {
    try {
      if (requestingUserId) {
        await this.validateUserTenantAccess(requestingUserId, tenantId);
      }

      const [userTenant] = await this.db
        .update(userTenants)
        .set({
          status,
          updatedAt: new Date(),
          ...(status === 'active' && { acceptedAt: new Date() }),
        })
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .returning();

      if (!userTenant) {
        throw new Error('User-tenant relationship not found');
      }
      return userTenant;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  /**
   * Check if user has super user access in tenant
   */
  async isUserSuperUser(userId: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ isSuperUser: userTenants.isSuperUser })
        .from(userTenants)
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      return result[0]?.isSuperUser || false;
    } catch (error) {
      this.handleError(error, 'isUserSuperUser');
    }
  }
}