import { eq, and } from 'drizzle-orm';
import {
  rolePermissions,
  RolePermission,
  NewRolePermission,
  roles,
  permissions,
  Permission,
  Role,
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
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

  async findByRoleId(roleId: string): Promise<{ role: Role; permissions: Permission[] }> {
    // First get the role
    const roleResult = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

    if (!roleResult[0]) {
      throw new NotFoundError(`Role not found with id ${roleId}`);
    }

    // Then get all permissions for this role
    const permissions = await this.findPermissionsByRoleId(roleId);

    return {
      role: roleResult[0],
      permissions,
    };
  }

  /**
   * Find role permission by role id and permission id
   */
  async findByRoleIdAndPermissionId(roleId: string, permissionId: string): Promise<RolePermission> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.roleId, roleId), eq(this.table.permissionId, permissionId)));

    if (!results[0]) {
      throw new NotFoundError(
        `Role permission not found for role ${roleId} and permission ${permissionId}`
      );
    }

    return results[0];
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
   * Revoke all permissions from role
   */
  async revokeAllPermissions(roleId: string): Promise<RolePermission[]> {
    return await this.db.delete(this.table).where(eq(this.table.roleId, roleId)).returning();
  }
}
