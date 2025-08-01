import {
  roleRepository,
  permissionRepository,
  rolePermissionRepository,
  userTenantRepository,
} from '@/repositories';
import {
  Role,
  Permission,
  RolePermission,
  NewRole,
  NewPermission,
  NewRolePermission,
} from '@/db/schema';

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
   * Creates a new role in the database.
   * @param roleData - The data for the new role.
   * @returns A promise that resolves to the created role.
   * @throws Throws an error if the role creation fails.
   */
  static async createRole(roleData: CreateRoleData, tenantId: string, userId?: string): Promise<Role> {
    const newRole: NewRole = {
      name: roleData.name,
      description: roleData.description || null,
    };

    return await roleRepository.create(newRole, tenantId, userId);
  }

  /**
   * Creates a new permission in the database.
   * @param permissionData - The data for the new permission.
   * @returns A promise that resolves to the created permission.
   * @throws Throws an error if the permission creation fails.
   */
  static async createPermission(permissionData: CreatePermissionData, tenantId: string, userId?: string): Promise<Permission> {
    const newPermission: NewPermission = {
      name: permissionData.name,
      description: permissionData.description || null,
      resource: permissionData.resource,
      action: permissionData.action,
    };

    return await permissionRepository.create(newPermission, tenantId, userId);
  }

  /**
   * Assigns a permission to a role.
   * If the permission is already assigned to the role, it returns the existing relationship.
   * @param roleId - The ID of the role.
   * @param permissionId - The ID of the permission to assign.
   * @returns A promise that resolves to the role-permission relationship object.
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
   * Removes a permission from a role.
   * @param roleId - The ID of the role.
   * @param permissionId - The ID of the permission to remove.
   * @returns A promise that resolves when the permission is removed.
   */
  static async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(
        and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
      );
  }

  /**
   * Retrieves all roles from the database.
   * @returns A promise that resolves to an array of all roles.
   */
  static async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  /**
   * Retrieves all permissions from the database.
   * @returns A promise that resolves to an array of all permissions.
   */
  static async getAllPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions);
  }

  /**
   * Retrieves a role by its ID, including its associated permissions.
   * @param roleId - The ID of the role to retrieve.
   * @returns A promise that resolves to the role object with its permissions, or null if not found.
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
   * Retrieves a role by its name.
   * @param name - The name of the role to retrieve.
   * @returns A promise that resolves to the role object or null if not found.
   */
  static async getRoleByName(name: string): Promise<Role | null> {
    const result = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return result[0] || null;
  }

  /**
   * Retrieves a permission by its name.
   * @param name - The name of the permission to retrieve.
   * @returns A promise that resolves to the permission object or null if not found.
   */
  static async getPermissionByName(name: string): Promise<Permission | null> {
    const result = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
    return result[0] || null;
  }

  /**
   * Retrieves a user's permissions for a specific tenant.
   * @param userId - The ID of the user.
   * @param tenantId - The ID of the tenant.
   * @returns A promise that resolves to an object containing the user's role and permissions, or null if the user is not associated with the tenant.
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
   * Checks if a user has a specific permission within a tenant.
   * @param userId - The ID of the user.
   * @param tenantId - The ID of the tenant.
   * @param resource - The resource the permission applies to.
   * @param action - The action the permission allows.
   * @returns A promise that resolves to true if the user has the permission, false otherwise.
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
   * Checks if a user has an admin role or super user privileges within a tenant.
   * @param userId - The ID of the user.
   * @param tenantId - The ID of the tenant.
   * @returns A promise that resolves to true if the user is an admin, false otherwise.
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
   * Updates a role's data.
   * @param roleId - The ID of the role to update.
   * @param updateData - An object containing the fields to update.
   * @returns A promise that resolves to the updated role object.
   * @throws Throws an error if the role is not found.
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
   * Deletes a role from the database.
   * @param roleId - The ID of the role to delete.
   * @returns A promise that resolves to the deleted role object.
   * @throws Throws an error if the role is not found.
   */
  static async deleteRole(roleId: string): Promise<Role> {
    const [role] = await db.delete(roles).where(eq(roles.id, roleId)).returning();

    if (!role) {
      throw new Error('Role not found');
    }

    return role;
  }
}
