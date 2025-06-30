import { eq, and, isNull } from 'drizzle-orm';
import {
  db,
  roles,
  permissions,
  rolePermissions,
  userTenants,
  Role,
  NewRole,
  Permission,
  RolePermission,
  NewRolePermission,
} from '@/db';

export interface CreateRoleData {
  name: string;
  description?: string;
  tenantId?: string;
  permissionIds?: string[];
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export class RoleService {
  /**
   * Create a new role
   */
  static async createRole(roleData: CreateRoleData): Promise<RoleWithPermissions> {
    const { permissionIds, ...roleInfo } = roleData;

    const newRole: NewRole = {
      name: roleInfo.name,
      description: roleInfo.description || null,
      tenantId: roleInfo.tenantId || null,
      isSystemRole: false,
    };

    const [role] = await db.insert(roles).values(newRole).returning();

    if (!role) {
      throw new Error('Failed to create role');
    }

    // Assign permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      await this.assignPermissionsToRole(role.id, permissionIds);
    }

    return this.getRoleWithPermissions(role.id);
  }

  /**
   * Get role by ID with permissions
   */
  static async getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions> {
    const role = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

    if (!role[0]) {
      throw new Error('Role not found');
    }

    const rolePerms = await db
      .select({
        permission: permissions,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return {
      ...role[0],
      permissions: rolePerms.map((rp) => rp.permission),
    };
  }

  /**
   * Get all roles for a tenant (including system roles)
   */
  static async getTenantRoles(tenantId: string): Promise<RoleWithPermissions[]> {
    const tenantRoles = await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId)));

    const systemRoles = await db
      .select()
      .from(roles)
      .where(and(eq(roles.isSystemRole, true), isNull(roles.tenantId)));

    const allRoles = [...tenantRoles, ...systemRoles];
    const rolesWithPermissions: RoleWithPermissions[] = [];

    for (const role of allRoles) {
      const roleWithPerms = await this.getRoleWithPermissions(role.id);
      rolesWithPermissions.push(roleWithPerms);
    }

    return rolesWithPermissions;
  }

  /**
   * Get all system roles
   */
  static async getSystemRoles(): Promise<RoleWithPermissions[]> {
    const systemRoles = await db.select().from(roles).where(eq(roles.isSystemRole, true));

    const rolesWithPermissions: RoleWithPermissions[] = [];

    for (const role of systemRoles) {
      const roleWithPerms = await this.getRoleWithPermissions(role.id);
      rolesWithPermissions.push(roleWithPerms);
    }

    return rolesWithPermissions;
  }

  /**
   * Assign permissions to a role
   */
  static async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    const rolePermissionData: NewRolePermission[] = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    await db.insert(rolePermissions).values(rolePermissionData).onConflictDoNothing();
  }

  /**
   * Remove permissions from a role
   */
  static async removePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<void> {
    for (const permissionId of permissionIds) {
      await db
        .delete(rolePermissions)
        .where(
          and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
        );
    }
  }

  /**
   * Update role
   */
  static async updateRole(
    roleId: string,
    updateData: Partial<CreateRoleData>
  ): Promise<RoleWithPermissions> {
    const { permissionIds, ...roleUpdate } = updateData;

    const [role] = await db
      .update(roles)
      .set({
        ...roleUpdate,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId))
      .returning();

    if (!role) {
      throw new Error('Role not found');
    }

    // Update permissions if provided
    if (permissionIds !== undefined) {
      // Remove all existing permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      // Add new permissions
      if (permissionIds.length > 0) {
        await this.assignPermissionsToRole(roleId, permissionIds);
      }
    }

    return this.getRoleWithPermissions(roleId);
  }

  /**
   * Delete role
   */
  static async deleteRole(roleId: string): Promise<Role> {
    // Check if role is assigned to any users
    const usersWithRole = await db
      .select()
      .from(userTenants)
      .where(eq(userTenants.roleId, roleId))
      .limit(1);

    if (usersWithRole.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    const [role] = await db.delete(roles).where(eq(roles.id, roleId)).returning();

    if (!role) {
      throw new Error('Role not found');
    }

    return role;
  }

  /**
   * Check if a user has a specific permission in a tenant
   */
  static async userHasPermission(
    userId: string,
    tenantId: string,
    permissionName: string
  ): Promise<boolean> {
    const result = await db
      .select({
        permission: permissions,
      })
      .from(userTenants)
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId),
          eq(permissions.name, permissionName)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get user permissions in a tenant
   */
  static async getUserPermissions(userId: string, tenantId: string): Promise<Permission[]> {
    const result = await db
      .select({
        permission: permissions,
      })
      .from(userTenants)
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)));

    return result.map((r) => r.permission);
  }
}
