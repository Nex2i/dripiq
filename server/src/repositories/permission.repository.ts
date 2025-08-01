import { eq } from 'drizzle-orm';
import { permissions, Permission, NewPermission } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export class PermissionRepository extends BaseRepository implements IRepository<Permission, NewPermission> {
  /**
   * Find permission by ID
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<Permission | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Find permission by name
   */
  async findByName(name: string, tenantId: string, userId?: string): Promise<Permission | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByName');
    }
  }

  /**
   * Create a new permission
   */
  async create(permissionData: NewPermission, tenantId: string, userId?: string): Promise<Permission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [permission] = await this.db.insert(permissions).values(permissionData).returning();
      if (!permission) {
        throw new Error('Failed to create permission');
      }
      return permission;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update permission
   */
  async update(id: string, updateData: Partial<NewPermission>, tenantId: string, userId?: string): Promise<Permission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [permission] = await this.db
        .update(permissions)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(permissions.id, id))
        .returning();

      if (!permission) {
        throw new Error('Permission not found');
      }
      return permission;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete permission
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<Permission> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [permission] = await this.db.delete(permissions).where(eq(permissions.id, id)).returning();
      if (!permission) {
        throw new Error('Permission not found');
      }
      return permission;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all permissions
   */
  async findAll(tenantId: string, userId?: string): Promise<Permission[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db.select().from(permissions).orderBy(permissions.name);
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  /**
   * Find permissions by resource
   */
  async findByResource(resource: string, tenantId: string, userId?: string): Promise<Permission[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(permissions)
        .where(eq(permissions.resource, resource))
        .orderBy(permissions.action);
    } catch (error) {
      this.handleError(error, 'findByResource');
    }
  }
}