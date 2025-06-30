import { eq, and, isNull } from 'drizzle-orm';
import {
  db,
  tenants,
  userTenants,
  users,
  roles,
  permissions,
  rolePermissions,
  Tenant,
  UserTenant,
  User,
  Role,
  NewTenant,
  NewUserTenant,
  NewRole,
  NewRolePermission,
} from '@/db';
import { PermissionService } from './permission.service';

export interface CreateTenantData {
  name: string;
}

export interface TenantWithUsers extends Tenant {
  users: (UserTenant & {
    user: User;
    role: Role;
  })[];
}

export class TenantService {
  /**
   * Create a new tenant in the database with default roles
   */
  static async createTenant(tenantData: CreateTenantData): Promise<Tenant> {
    const newTenant: NewTenant = {
      name: tenantData.name,
    };

    const [tenant] = await db.insert(tenants).values(newTenant).returning();

    if (!tenant) {
      throw new Error('Failed to create tenant');
    }

    // Create default roles for the tenant
    await this.createDefaultRoles(tenant.id);

    return tenant;
  }

  /**
   * Create default roles for a tenant
   */
  static async createDefaultRoles(tenantId: string): Promise<void> {
    // Get all permissions
    const allPermissions = await db.select().from(permissions);

    if (allPermissions.length === 0) {
      // Initialize permissions if they don't exist
      await PermissionService.initializeDefaultPermissions();
      const refreshedPermissions = await db.select().from(permissions);
      allPermissions.push(...refreshedPermissions);
    }

    // Create Admin role with all permissions
    const adminRole: NewRole = {
      name: 'Admin',
      description: 'Full administrative access to the tenant',
      tenantId,
      isSystemRole: false,
    };

    const [adminRoleCreated] = await db.insert(roles).values(adminRole).returning();

    if (adminRoleCreated) {
      // Assign all permissions to admin role
      const adminPermissions: NewRolePermission[] = allPermissions.map((permission) => ({
        roleId: adminRoleCreated.id,
        permissionId: permission.id,
      }));

      if (adminPermissions.length > 0) {
        await db.insert(rolePermissions).values(adminPermissions);
      }
    }

    // Create Manager role with limited permissions
    const managerRole: NewRole = {
      name: 'Manager',
      description: 'Can manage users and view tenant information',
      tenantId,
      isSystemRole: false,
    };

    const [managerRoleCreated] = await db.insert(roles).values(managerRole).returning();

    if (managerRoleCreated) {
      // Assign specific permissions to manager role
      const managerPermissionNames = [
        'users:read',
        'users:invite',
        'users:update',
        'users:deactivate',
        'roles:read',
        'roles:assign',
        'tenants:read',
      ];

      const managerPermissionIds = allPermissions
        .filter((p) => managerPermissionNames.includes(p.name))
        .map((p) => p.id);

      const managerPermissions: NewRolePermission[] = managerPermissionIds.map((permissionId) => ({
        roleId: managerRoleCreated.id,
        permissionId,
      }));

      if (managerPermissions.length > 0) {
        await db.insert(rolePermissions).values(managerPermissions);
      }
    }

    // Create Member role with basic permissions
    const memberRole: NewRole = {
      name: 'Member',
      description: 'Basic member access',
      tenantId,
      isSystemRole: false,
    };

    const [memberRoleCreated] = await db.insert(roles).values(memberRole).returning();

    if (memberRoleCreated) {
      // Assign basic permissions to member role
      const memberPermissionNames = ['tenants:read'];

      const memberPermissionIds = allPermissions
        .filter((p) => memberPermissionNames.includes(p.name))
        .map((p) => p.id);

      const memberPermissions: NewRolePermission[] = memberPermissionIds.map((permissionId) => ({
        roleId: memberRoleCreated.id,
        permissionId,
      }));

      if (memberPermissions.length > 0) {
        await db.insert(rolePermissions).values(memberPermissions);
      }
    }

    // Create Viewer role with read-only permissions
    const viewerRole: NewRole = {
      name: 'Viewer',
      description: 'Read-only access to all resources',
      tenantId,
      isSystemRole: false,
    };

    const [viewerRoleCreated] = await db.insert(roles).values(viewerRole).returning();

    if (viewerRoleCreated) {
      // Assign all read permissions to viewer role
      const viewerPermissionNames = [
        'users:read',
        'roles:read',
        'tenants:read',
        'permissions:read',
      ];

      const viewerPermissionIds = allPermissions
        .filter((p) => viewerPermissionNames.includes(p.name))
        .map((p) => p.id);

      const viewerPermissions: NewRolePermission[] = viewerPermissionIds.map((permissionId) => ({
        roleId: viewerRoleCreated.id,
        permissionId,
      }));

      if (viewerPermissions.length > 0) {
        await db.insert(rolePermissions).values(viewerPermissions);
      }
    }
  }

  /**
   * Get default admin role for a tenant
   */
  static async getDefaultAdminRole(tenantId: string): Promise<Role | null> {
    const result = await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.name, 'Admin')))
      .limit(1);

    return result[0] || null;
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

    // Get users for this tenant with their roles
    const tenantUsers = await db
      .select()
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(eq(userTenants.tenantId, tenantId));

    return {
      ...tenant,
      users: tenantUsers.map((row) => ({
        ...row.user_tenants,
        user: row.users,
        role: row.roles,
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
   * Add user to tenant with specific role
   */
  static async addUserToTenant(
    userId: string,
    tenantId: string,
    isSuperUser: boolean = false,
    roleId?: string
  ): Promise<UserTenant> {
    // If no roleId provided, get the default admin role for super users or member role for regular users
    let finalRoleId = roleId;

    if (!finalRoleId) {
      if (isSuperUser) {
        const adminRole = await this.getDefaultAdminRole(tenantId);
        if (!adminRole) {
          throw new Error('Default admin role not found for tenant');
        }
        finalRoleId = adminRole.id;
      } else {
        // Get default member role
        const memberRole = await db
          .select()
          .from(roles)
          .where(and(eq(roles.tenantId, tenantId), eq(roles.name, 'Member')))
          .limit(1)
          .then((result) => result[0]);

        if (!memberRole) {
          throw new Error('Default member role not found for tenant');
        }
        finalRoleId = memberRole.id;
      }
    }

    try {
      const newUserTenant: NewUserTenant = {
        userId,
        tenantId,
        roleId: finalRoleId,
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
  static async getUserTenants(
    userId: string
  ): Promise<(UserTenant & { tenant: Tenant; role: Role })[]> {
    const result = await db
      .select()
      .from(userTenants)
      .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(eq(userTenants.userId, userId));

    return result.map((row) => ({
      ...row.user_tenants,
      tenant: row.tenants,
      role: row.roles,
    }));
  }

  /**
   * Update tenant data
   */
  static async updateTenant(
    tenantId: string,
    updateData: Partial<CreateTenantData>
  ): Promise<Tenant> {
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
   * Delete tenant
   */
  static async deleteTenant(tenantId: string): Promise<Tenant> {
    const [tenant] = await db.delete(tenants).where(eq(tenants.id, tenantId)).returning();

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return tenant;
  }
}
