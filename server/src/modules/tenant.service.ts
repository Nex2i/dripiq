import { eq, and } from 'drizzle-orm';
import {
  db,
  tenants,
  userTenants,
  users,
  Tenant,
  UserTenant,
  User,
  NewTenant,
  NewUserTenant,
} from '@/db';

export interface CreateTenantData {
  name: string;
}

export interface TenantWithUsers extends Tenant {
  users: (UserTenant & {
    user: User;
  })[];
}

export class TenantService {
  /**
   * Create a new tenant in the database
   */
  static async createTenant(tenantData: CreateTenantData): Promise<Tenant> {
    const newTenant: NewTenant = {
      name: tenantData.name,
    };

    const [tenant] = await db.insert(tenants).values(newTenant).returning();

    if (!tenant) {
      throw new Error('Failed to create tenant');
    }

    return tenant;
  }

  /**
   * Get tenant by ID with users
   */
  static async getTenantById(tenantId: string): Promise<TenantWithUsers | null> {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
      .then((result) => result[0]);

    if (!tenant) {
      return null;
    }

    // Get users for this tenant
    const tenantUsers = await db
      .select()
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(eq(userTenants.tenantId, tenantId));

    return {
      ...tenant,
      users: tenantUsers.map((row) => ({
        ...row.user_tenants,
        user: row.users,
      })),
    };
  }

  /**
   * Get tenant by name
   */
  static async getTenantByName(name: string): Promise<Tenant | null> {
    const result = await db.select().from(tenants).where(eq(tenants.name, name)).limit(1);

    return result[0] || null;
  }

  /**
   * Add user to tenant with role
   */
  static async addUserToTenant(
    userId: string,
    tenantId: string,
    roleId: string,
    isSuperUser: boolean = false
  ): Promise<UserTenant> {
    try {
      const newUserTenant: NewUserTenant = {
        userId,
        tenantId,
        roleId,
        isSuperUser,
      };

      const [userTenant] = await db.insert(userTenants).values(newUserTenant).returning();
      return userTenant!;
    } catch (error: any) {
      // If relationship already exists (unique constraint violation), fetch and return it
      if (error.code === '23505') {
        const existingRelation = await db
          .select()
          .from(userTenants)
          .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
          .limit(1)
          .then((result: any) => result[0]);

        if (!existingRelation) {
          throw new Error('UserTenant creation failed and relation not found');
        }
        return existingRelation;
      }
      throw error;
    }
  }

  /**
   * Get user's tenants
   */
  static async getUserTenants(userId: string): Promise<(UserTenant & { tenant: Tenant })[]> {
    const result = await db
      .select()
      .from(userTenants)
      .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
      .where(eq(userTenants.userId, userId));

    return result.map((row) => ({
      ...row.user_tenants,
      tenant: row.tenants,
    }));
  }

  /**
   * Update tenant data (with user access validation)
   */
  static async updateTenant(
    userId: string,
    tenantId: string,
    updateData: Partial<CreateTenantData>
  ): Promise<Tenant> {
    // Validate user has access to this tenant
    const { validateUserTenantAccess } = await import('../utils/tenantValidation');
    await validateUserTenantAccess(userId, tenantId);

    const [tenant] = await db
      .update(tenants)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return tenant;
  }

  /**
   * Delete tenant (with user access validation)
   */
  static async deleteTenant(userId: string, tenantId: string): Promise<Tenant> {
    // Validate user has super user access to this tenant
    const { validateUserSuperAccess } = await import('../utils/tenantValidation');
    await validateUserSuperAccess(userId, tenantId);

    const [tenant] = await db.delete(tenants).where(eq(tenants.id, tenantId)).returning();

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return tenant;
  }

  /**
   * Get tenant by ID (with user access validation)
   */
  static async getTenantByIdSecure(
    userId: string,
    tenantId: string
  ): Promise<TenantWithUsers | null> {
    // Validate user has access to this tenant
    const { validateUserTenantAccess } = await import('../utils/tenantValidation');
    await validateUserTenantAccess(userId, tenantId);

    return this.getTenantById(tenantId);
  }
}
