import { eq } from 'drizzle-orm';
import { roles, Role, NewRole } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export class RoleRepository extends BaseRepository implements IRepository<Role, NewRole> {
  /**
   * Find role by ID - roles are global but access should be validated
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<Role | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Find role by name
   */
  async findByName(name: string, tenantId: string, userId?: string): Promise<Role | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.select().from(roles).where(eq(roles.name, name)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByName');
    }
  }

  /**
   * Create a new role
   */
  async create(roleData: NewRole, tenantId: string, userId?: string): Promise<Role> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [role] = await this.db.insert(roles).values(roleData).returning();
      if (!role) {
        throw new Error('Failed to create role');
      }
      return role;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update role
   */
  async update(id: string, updateData: Partial<NewRole>, tenantId: string, userId?: string): Promise<Role> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [role] = await this.db
        .update(roles)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, id))
        .returning();

      if (!role) {
        throw new Error('Role not found');
      }
      return role;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete role
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<Role> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [role] = await this.db.delete(roles).where(eq(roles.id, id)).returning();
      if (!role) {
        throw new Error('Role not found');
      }
      return role;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all roles
   */
  async findAll(tenantId: string, userId?: string): Promise<Role[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db.select().from(roles).orderBy(roles.name);
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  /**
   * Check if role exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'exists');
    }
  }
}