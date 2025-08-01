import { 
  roleRepository, 
  permissionRepository, 
  rolePermissionRepository, 
  userTenantRepository 
} from '@/repositories';
import { NewRole, NewPermission, Role, Permission } from '@/db/schema';

// Types and interfaces
export interface CreateRoleData {
  name: string;
  description?: string;
}

export interface CreatePermissionData {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface UserRoleInfo {
  role: {
    id: string;
    name: string;
    description?: string;
  };
  permissions: Permission[];
}

export class RoleService {
  /**
   * Create a new role
   */
  static async createRole(roleData: CreateRoleData, tenantId: string, userId?: string): Promise<Role> {
    const newRoleData: NewRole = {
      name: roleData.name,
      description: roleData.description,
    };
    
    return await roleRepository.create(newRoleData, tenantId, userId);
  }

  /**
   * Create a new permission
   */
  static async createPermission(permissionData: CreatePermissionData, tenantId: string, userId?: string): Promise<Permission> {
    const newPermissionData: NewPermission = {
      name: permissionData.name,
      resource: permissionData.resource,
      action: permissionData.action,
      description: permissionData.description,
    };
    
    return await permissionRepository.create(newPermissionData, tenantId, userId);
  }

  /**
   * Add a permission to a role
   */
  static async addPermissionToRole(roleId: string, permissionId: string, tenantId: string, userId?: string): Promise<void> {
    await rolePermissionRepository.addPermissionToRole(roleId, permissionId, tenantId, userId);
  }

  /**
   * Remove a permission from a role
   */
  static async removePermissionFromRole(roleId: string, permissionId: string, tenantId: string, userId?: string): Promise<void> {
    await rolePermissionRepository.removePermissionFromRole(roleId, permissionId, tenantId, userId);
  }

  /**
   * Get all roles
   */
  static async getAllRoles(tenantId: string, userId?: string): Promise<Role[]> {
    return await roleRepository.findAll(tenantId, userId);
  }

  /**
   * Get all permissions
   */
  static async getAllPermissions(tenantId: string, userId?: string): Promise<Permission[]> {
    return await permissionRepository.findAll(tenantId, userId);
  }

  /**
   * Get role with permissions
   */
  static async getRoleWithPermissions(roleId: string, tenantId: string, userId?: string): Promise<RoleWithPermissions | null> {
    const roleWithPerms = await rolePermissionRepository.getRoleWithPermissions(roleId, tenantId, userId);
    if (!roleWithPerms) return null;

    return {
      id: roleWithPerms.role.id,
      name: roleWithPerms.role.name,
      description: roleWithPerms.role.description,
      permissions: roleWithPerms.permissions,
    };
  }

  /**
   * Get role by name
   */
  static async getRoleByName(name: string, tenantId: string, userId?: string): Promise<Role | null> {
    return await roleRepository.findByName(name, tenantId, userId);
  }

  /**
   * Get permission by name
   */
  static async getPermissionByName(name: string, tenantId: string, userId?: string): Promise<Permission | null> {
    return await permissionRepository.findByName(name, tenantId, userId);
  }

  /**
   * Get user's role and permissions for a specific tenant
   */
  static async getUserRoleAndPermissions(userId: string, tenantId: string): Promise<UserRoleInfo | null> {
    const userTenant = await userTenantRepository.findByUserAndTenant(userId, tenantId);
    if (!userTenant) return null;

    const roleWithPerms = await rolePermissionRepository.getRoleWithPermissions(userTenant.roleId, tenantId, userId);
    if (!roleWithPerms) return null;

    return {
      role: {
        id: roleWithPerms.role.id,
        name: roleWithPerms.role.name,
        description: roleWithPerms.role.description,
      },
      permissions: roleWithPerms.permissions,
    };
  }

  /**
   * Check if user has a specific permission
   */
  static async userHasPermission(userId: string, tenantId: string, permissionName: string): Promise<boolean> {
    const userRole = await this.getUserRoleAndPermissions(userId, tenantId);
    if (!userRole) return false;

    return userRole.permissions.some(p => p.name === permissionName);
  }

  /**
   * Update role
   */
  static async updateRole(roleId: string, roleData: Partial<CreateRoleData>, tenantId: string, userId?: string): Promise<Role> {
    return await roleRepository.update(roleId, roleData, tenantId, userId);
  }

  /**
   * Delete role
   */
  static async deleteRole(roleId: string, tenantId: string, userId?: string): Promise<void> {
    await roleRepository.delete(roleId, tenantId, userId);
  }

  /**
   * Check if a role has a specific permission
   */
  static async roleHasPermission(roleId: string, permissionId: string, tenantId: string, userId?: string): Promise<boolean> {
    return await rolePermissionRepository.roleHasPermission(roleId, permissionId, tenantId, userId);
  }

  /**
   * Get permissions by role
   */
  static async getPermissionsByRole(roleId: string, tenantId: string, userId?: string): Promise<Permission[]> {
    return await rolePermissionRepository.getPermissionsByRole(roleId, tenantId, userId);
  }
}