import { eq, and } from 'drizzle-orm';
import { db, permissions, Permission, NewPermission } from '@/db';

export interface CreatePermissionData {
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export class PermissionService {
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
   * Get all permissions
   */
  static async getAllPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions);
  }

  /**
   * Get permission by name
   */
  static async getPermissionByName(name: string): Promise<Permission | null> {
    const result = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
    return result[0] || null;
  }

  /**
   * Get permissions by resource
   */
  static async getPermissionsByResource(resource: string): Promise<Permission[]> {
    return await db.select().from(permissions).where(eq(permissions.resource, resource));
  }

  /**
   * Get permissions by resource and action
   */
  static async getPermissionByResourceAndAction(
    resource: string,
    action: string
  ): Promise<Permission | null> {
    const result = await db
      .select()
      .from(permissions)
      .where(and(eq(permissions.resource, resource), eq(permissions.action, action)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update permission
   */
  static async updatePermission(
    permissionId: string,
    updateData: Partial<CreatePermissionData>
  ): Promise<Permission> {
    const [permission] = await db
      .update(permissions)
      .set(updateData)
      .where(eq(permissions.id, permissionId))
      .returning();

    if (!permission) {
      throw new Error('Permission not found');
    }

    return permission;
  }

  /**
   * Delete permission
   */
  static async deletePermission(permissionId: string): Promise<Permission> {
    const [permission] = await db
      .delete(permissions)
      .where(eq(permissions.id, permissionId))
      .returning();

    if (!permission) {
      throw new Error('Permission not found');
    }

    return permission;
  }

  /**
   * Initialize default permissions
   */
  static async initializeDefaultPermissions(): Promise<void> {
    const defaultPermissions: CreatePermissionData[] = [
      // User management permissions
      {
        name: 'users:create',
        description: 'Create new users',
        resource: 'users',
        action: 'create',
      },
      { name: 'users:read', description: 'View users', resource: 'users', action: 'read' },
      {
        name: 'users:update',
        description: 'Update user information',
        resource: 'users',
        action: 'update',
      },
      { name: 'users:delete', description: 'Delete users', resource: 'users', action: 'delete' },
      {
        name: 'users:invite',
        description: 'Invite new users to tenant',
        resource: 'users',
        action: 'invite',
      },
      {
        name: 'users:deactivate',
        description: 'Deactivate/activate users',
        resource: 'users',
        action: 'deactivate',
      },

      // Role management permissions
      {
        name: 'roles:create',
        description: 'Create new roles',
        resource: 'roles',
        action: 'create',
      },
      { name: 'roles:read', description: 'View roles', resource: 'roles', action: 'read' },
      { name: 'roles:update', description: 'Update roles', resource: 'roles', action: 'update' },
      { name: 'roles:delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
      {
        name: 'roles:assign',
        description: 'Assign roles to users',
        resource: 'roles',
        action: 'assign',
      },

      // Tenant management permissions
      {
        name: 'tenants:read',
        description: 'View tenant information',
        resource: 'tenants',
        action: 'read',
      },
      {
        name: 'tenants:update',
        description: 'Update tenant settings',
        resource: 'tenants',
        action: 'update',
      },
      {
        name: 'tenants:delete',
        description: 'Delete tenant',
        resource: 'tenants',
        action: 'delete',
      },

      // Permission management permissions
      {
        name: 'permissions:read',
        description: 'View permissions',
        resource: 'permissions',
        action: 'read',
      },
    ];

    for (const permissionData of defaultPermissions) {
      try {
        // Check if permission already exists
        const existing = await this.getPermissionByName(permissionData.name);
        if (!existing) {
          await this.createPermission(permissionData);
        }
      } catch (error) {
        // Log error but continue with other permissions
        console.error(`Error creating permission ${permissionData.name}:`, error);
      }
    }
  }
}
