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
   * Creates a new tenant in the database.
   * @param tenantData - The data for the new tenant.
   * @returns A promise that resolves to the created tenant.
   * @throws Throws an error if the tenant creation fails.
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
   * Retrieves a tenant by its ID, including a list of its associated users.
   * @param tenantId - The ID of the tenant to retrieve.
   * @returns A promise that resolves to the tenant object with its users, or null if not found.
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
   * Retrieves a tenant by its name.
   * @param name - The name of the tenant to retrieve.
   * @returns A promise that resolves to the tenant object or null if not found.
   */
  static async getTenantByName(name: string): Promise<Tenant | null> {
    const result = await db.select().from(tenants).where(eq(tenants.name, name)).limit(1);

    return result[0] || null;
  }

  /**
   * Adds a user to a tenant with a specific role.
   * If the user is already associated with the tenant, it returns the existing relationship.
   * @param userId - The ID of the user to add.
   * @param tenantId - The ID of the tenant to which the user will be added.
   * @param roleId - The ID of the role to assign to the user within the tenant.
   * @param isSuperUser - A boolean indicating if the user should have super user privileges in the tenant.
   * @returns A promise that resolves to the user-tenant relationship object.
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
   * Retrieves all tenants a user is associated with.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to an array of user-tenant objects, with the full tenant object nested.
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
   * Updates a tenant's data after validating that the requesting user has access.
   * @param userId - The ID of the user making the request.
   * @param tenantId - The ID of the tenant to update.
   * @param updateData - An object containing the fields to update.
   * @returns A promise that resolves to the updated tenant object.
   * @throws Throws an error if the tenant is not found.
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
   * Deletes a tenant after validating that the requesting user has super user access.
   * @param userId - The ID of the user making the request.
   * @param tenantId - The ID of the tenant to delete.
   * @returns A promise that resolves to the deleted tenant object.
   * @throws Throws an error if the tenant is not found.
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
   * Retrieves a tenant by its ID securely, by first validating user access.
   * @param userId - The ID of the user making the request.
   * @param tenantId - The ID of the tenant to retrieve.
   * @returns A promise that resolves to the tenant object with its users, or null if not found.
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
