import { eq, and } from 'drizzle-orm';
import {
  db,
  roles,
  permissions,
  rolePermissions,
  userTenants,
  Role,
  Permission,
  RolePermission,
  NewRole,
  NewPermission,
  NewRolePermission,
} from '@/db';

export interface CreateRoleData {
  name: string;
  description?: string;
}

export interface CreatePermissionData {
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export interface RoleWithPermissions extends Role {
  permissions: (RolePermission & {
    permission: Permission;
  })[];
}

export interface UserPermissions {
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export class RoleService {
  /**
   * Create a new role
   */
  static async createRole(roleData: CreateRoleData): Promise<Role> {
    const newRole: NewRole = {
      name: roleData.name,
      description: roleData.description || null,
    };

    const [role] = await db.insert(roles).values(newRole).returning();

    if (!role) {
      throw new Error('Failed to create role');
    }

    return role;
  }

  /**
   * Create a new permission
   */
  static async createPermission(permissionData: CreatePermissionData): Promise<Permission> {
    const newPermission: NewPermission = {
      name: permissionData.name,
      description: permissionData.description || null,
      resource: permissionData.resource,
      action: permissionData.action,
    };

    const [permission] = await db.insert(permissions).values(newPermission).returning();

    if (!permission) {
      throw new Error('Failed to create permission');
    }

    return permission;
  }

  /**
   * Assign permission to role
   */
  static async assignPermissionToRole(
    roleId: string,
    permissionId: string
  ): Promise<RolePermission> {
    try {
      const newRolePermission: NewRolePermission = {
        roleId,
        permissionId,
      };

      const [rolePermission] = await db
        .insert(rolePermissions)
        .values(newRolePermission)
        .returning();
      return rolePermission!;
    } catch (error: any) {
      // If relationship already exists (unique constraint violation), fetch and return it
      if (error.code === '23505') {
        const existingRelation = await db
          .select()
          .from(rolePermissions)
          .where(
            and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
          )
          .limit(1)
          .then((result) => result[0]);

        if (!existingRelation) {
          throw new Error('RolePermission creation failed and relation not found');
        }
        return existingRelation;
      }
      throw error;
    }
  }

  /**
   * Remove permission from role
   */
  static async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(
        and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
      );
  }

  /**
   * Get all roles
   */
  static async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  /**
   * Get all permissions
   */
  static async getAllPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions);
  }

  /**
   * Get role by ID with permissions
   */
  static async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    const role = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)
      .then((result) => result[0]);

    if (!role) {
      return null;
    }

    // Get permissions for this role
    const rolePermissionsData = await db
      .select()
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return {
      ...role,
      permissions: rolePermissionsData.map((row) => ({
        ...row.role_permissions,
        permission: row.permissions,
      })),
    };
  }

  /**
   * Get role by name
   */
  static async getRoleByName(name: string): Promise<Role | null> {
    const result = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return result[0] || null;
  }

  /**
   * Get permission by name
   */
  static async getPermissionByName(name: string): Promise<Permission | null> {
    const result = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
    return result[0] || null;
  }

  /**
   * Get user permissions for a specific tenant
   */
  static async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<UserPermissions | null> {
    const userTenant = await db
      .select()
      .from(userTenants)
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1)
      .then((result) => result[0]);

    if (!userTenant) {
      return null;
    }

    // Get permissions for the user's role
    const rolePermissionsData = await db
      .select()
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, userTenant.roles.id));

    return {
      roleId: userTenant.roles.id,
      roleName: userTenant.roles.name,
      permissions: rolePermissionsData.map((row) => row.permissions),
    };
  }

  /**
   * Check if user has specific permission
   */
  static async userHasPermission(
    userId: string,
    tenantId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, tenantId);

    if (!userPermissions) {
      return false;
    }

    return userPermissions.permissions.some(
      (permission) => permission.resource === resource && permission.action === action
    );
  }

  /**
   * Check if user has admin role (full permissions)
   */
  static async userIsAdmin(userId: string, tenantId: string): Promise<boolean> {
    const userTenant = await db
      .select()
      .from(userTenants)
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1)
      .then((result) => result[0]);

    if (!userTenant) {
      return false;
    }

    // Check if user is super user or has admin role
    return userTenant.user_tenants.isSuperUser || userTenant.roles.name === 'Admin';
  }

  /**
   * Update role
   */
  static async updateRole(roleId: string, updateData: Partial<CreateRoleData>): Promise<Role> {
    const [role] = await db
      .update(roles)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId))
      .returning();

    if (!role) {
      throw new Error('Role not found');
    }

    return role;
  }

  /**
   * Delete role
   */
  static async deleteRole(roleId: string): Promise<Role> {
    const [role] = await db.delete(roles).where(eq(roles.id, roleId)).returning();

    if (!role) {
      throw new Error('Role not found');
    }

    return role;
  }
}
