import { eq, and, inArray } from 'drizzle-orm';
import {
  rolePermissions,
  RolePermission,
  NewRolePermission,
  roles,
  permissions,
} from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export interface RoleWithPermissions {
  role: typeof roles.$inferSelect;
  permissions: (typeof permissions.$inferSelect)[];
}

export interface PermissionWithRoles {
  permission: typeof permissions.$inferSelect;
  roles: (typeof roles.$inferSelect)[];
}

export class RolePermissionRepository extends BaseRepository<
  typeof rolePermissions,
  RolePermission,
  NewRolePermission
> {
  constructor() {
    super(rolePermissions);
  }

  /**
   * Find permissions for a role
   */
  async findPermissionsByRoleId(roleId: string): Promise<(typeof permissions.$inferSelect)[]> {
    const results = await this.db
      .select({ permission: permissions })
      .from(this.table)
      .innerJoin(permissions, eq(this.table.permissionId, permissions.id))
      .where(eq(this.table.roleId, roleId));
    return results.map((result) => result.permission);
  }

  /**
   * Find roles for a permission
   */
  async findRolesByPermissionId(permissionId: string): Promise<(typeof roles.$inferSelect)[]> {
    const results = await this.db
      .select({ role: roles })
      .from(this.table)
      .innerJoin(roles, eq(this.table.roleId, roles.id))
      .where(eq(this.table.permissionId, permissionId));
    return results.map((result) => result.role);
  }

  /**
   * Check if role has permission
   */
  async hasPermission(roleId: string, permissionId: string): Promise<boolean> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.roleId, roleId), eq(this.table.permissionId, permissionId)))
      .limit(1);
    return results.length > 0;
  }

  /**
   * Grant permission to role
   */
  async grantPermission(roleId: string, permissionId: string): Promise<RolePermission> {
    // Check if already exists
    const existing = await this.hasPermission(roleId, permissionId);
    if (existing) {
      const result = await this.db
        .select()
        .from(this.table)
        .where(and(eq(this.table.roleId, roleId), eq(this.table.permissionId, permissionId)))
        .limit(1);
      if (result[0]) {
        return result[0];
      }
    }

    return await this.create({ roleId, permissionId });
  }

  /**
   * Grant multiple permissions to role
   */
  async grantPermissions(roleId: string, permissionIds: string[]): Promise<RolePermission[]> {
    if (permissionIds.length === 0) return [];

    // Get existing permissions to avoid duplicates
    const existingPermissions = await this.findPermissionsByRoleId(roleId);
    const existingPermissionIds = existingPermissions.map((p) => p.id);

    // Filter out already granted permissions
    const newPermissionIds = permissionIds.filter((id) => !existingPermissionIds.includes(id));

    if (newPermissionIds.length === 0) return [];

    const rolePermissionData = newPermissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    return await this.createMany(rolePermissionData);
  }

  /**
   * Revoke permission from role
   */
  async revokePermission(
    roleId: string,
    permissionId: string
  ): Promise<RolePermission | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.roleId, roleId), eq(this.table.permissionId, permissionId)))
      .returning();
    return result;
  }

  /**
   * Revoke multiple permissions from role
   */
  async revokePermissions(roleId: string, permissionIds: string[]): Promise<RolePermission[]> {
    if (permissionIds.length === 0) return [];

    return await this.db
      .delete(this.table)
      .where(and(eq(this.table.roleId, roleId), inArray(this.table.permissionId, permissionIds)))
      .returning();
  }

  /**
   * Revoke all permissions from role
   */
  async revokeAllPermissions(roleId: string): Promise<RolePermission[]> {
    return await this.db.delete(this.table).where(eq(this.table.roleId, roleId)).returning();
  }

  /**
   * Set permissions for role (replace all existing permissions)
   */
  async setPermissionsForRole(roleId: string, permissionIds: string[]): Promise<RolePermission[]> {
    // First revoke all existing permissions
    await this.revokeAllPermissions(roleId);

    // Then grant the new permissions
    if (permissionIds.length === 0) return [];

    const rolePermissionData = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    return await this.createMany(rolePermissionData);
  }

  /**
   * Get all roles with their permissions
   */
  async getAllRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    const allRoles = await this.db.select().from(roles);
    const result: RoleWithPermissions[] = [];

    for (const role of allRoles) {
      const permissions = await this.findPermissionsByRoleId(role.id);
      result.push({ role, permissions });
    }

    return result;
  }

  /**
   * Get all permissions with their roles
   */
  async getAllPermissionsWithRoles(): Promise<PermissionWithRoles[]> {
    const allPermissions = await this.db.select().from(permissions);
    const result: PermissionWithRoles[] = [];

    for (const permission of allPermissions) {
      const roles = await this.findRolesByPermissionId(permission.id);
      result.push({ permission, roles });
    }

    return result;
  }

  /**
   * Check if role has any of the specified permissions
   */
  async hasAnyPermission(roleId: string, permissionIds: string[]): Promise<boolean> {
    if (permissionIds.length === 0) return false;

    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.roleId, roleId), inArray(this.table.permissionId, permissionIds)))
      .limit(1);
    return results.length > 0;
  }

  /**
   * Check if role has all of the specified permissions
   */
  async hasAllPermissions(roleId: string, permissionIds: string[]): Promise<boolean> {
    if (permissionIds.length === 0) return true;

    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.roleId, roleId), inArray(this.table.permissionId, permissionIds)));

    return results.length === permissionIds.length;
  }
}
