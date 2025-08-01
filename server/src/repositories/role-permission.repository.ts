import { eq, and } from 'drizzle-orm';
import { rolePermissions, roles, permissions, RolePermission, NewRolePermission, Role, Permission } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export interface RoleWithPermissions extends Role {
  permissions: (RolePermission & {
    permission: Permission;
  })[];
}

export class RolePermissionRepository extends BaseRepository implements IRepository<RolePermission, NewRolePermission> {
  /**
   * Find role permission by ID
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<RolePermission | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new role-permission association
   */
  async create(data: NewRolePermission, tenantId: string, userId?: string): Promise<RolePermission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [rolePermission] = await this.db.insert(rolePermissions).values(data).returning();
      if (!rolePermission) {
        throw new Error('Failed to create role permission');
      }
      return rolePermission;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update role permission (not typically used for junction tables)
   */
  async update(id: string, updateData: Partial<NewRolePermission>, tenantId: string, userId?: string): Promise<RolePermission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [rolePermission] = await this.db
        .update(rolePermissions)
        .set(updateData)
        .where(eq(rolePermissions.id, id))
        .returning();

      if (!rolePermission) {
        throw new Error('Role permission not found');
      }
      return rolePermission;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete role permission
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<RolePermission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [rolePermission] = await this.db
        .delete(rolePermissions)
        .where(eq(rolePermissions.id, id))
        .returning();

      if (!rolePermission) {
        throw new Error('Role permission not found');
      }
      return rolePermission;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Add permission to role
   */
  async addPermissionToRole(roleId: string, permissionId: string, tenantId: string, userId?: string): Promise<RolePermission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.create({ roleId, permissionId }, tenantId, userId);
    } catch (error) {
      this.handleError(error, 'addPermissionToRole');
    }
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string, tenantId: string, userId?: string): Promise<void> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      await this.db
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
    } catch (error) {
      this.handleError(error, 'removePermissionFromRole');
    }
  }

  /**
   * Get role with all its permissions
   */
  async getRoleWithPermissions(roleId: string, tenantId: string, userId?: string): Promise<RoleWithPermissions | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Get the role
      const roleResult = await this.db
        .select()
        .from(roles)
        .where(eq(roles.id, roleId))
        .limit(1);

      if (!roleResult[0]) {
        return null;
      }

      const role = roleResult[0];

      // Get permissions for this role
      const permissionsResult = await this.db
        .select()
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));

      return {
        ...role,
        permissions: permissionsResult.map((row) => ({
          ...row.role_permissions,
          permission: row.permissions,
        })),
      };
    } catch (error) {
      this.handleError(error, 'getRoleWithPermissions');
    }
  }

  /**
   * Get permissions for a role
   */
  async getPermissionsByRole(roleId: string, tenantId: string, userId?: string): Promise<Permission[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select({ permission: permissions })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));

      return result.map(row => row.permission);
    } catch (error) {
      this.handleError(error, 'getPermissionsByRole');
    }
  }

  /**
   * Check if role has specific permission
   */
  async roleHasPermission(roleId: string, permissionId: string, tenantId: string, userId?: string): Promise<boolean> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select({ id: rolePermissions.id })
        .from(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'roleHasPermission');
    }
  }
}