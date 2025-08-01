import { eq } from 'drizzle-orm';
import { users, userTenants, tenants, User, NewUser, UserTenant } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export class UserRepository extends BaseRepository {
  /**
   * Find user by ID - Users are global, tenant validation optional for certain operations
   */
  async findById(id: string, tenantId?: string, userId?: string): Promise<User | null> {
    try {
      if (userId && tenantId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Find user by Supabase ID
   */
  async findBySupabaseId(supabaseId: string): Promise<User | null> {
    try {
      const result = await this.db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findBySupabaseId');
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByEmail');
    }
  }

  /**
   * Create a new user
   */
  async create(userData: NewUser): Promise<User> {
    try {
      const [user] = await this.db.insert(users).values(userData).returning();
      if (!user) {
        throw new Error('Failed to create user');
      }
      return user;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update user by Supabase ID
   */
  async updateBySupabaseId(supabaseId: string, updateData: Partial<NewUser>): Promise<User> {
    try {
      const [user] = await this.db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.supabaseId, supabaseId))
        .returning();

      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      this.handleError(error, 'updateBySupabaseId');
    }
  }

  /**
   * Update user by ID
   */
  async update(id: string, updateData: Partial<NewUser>): Promise<User> {
    try {
      const [user] = await this.db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete user by Supabase ID
   */
  async deleteBySupabaseId(supabaseId: string): Promise<User> {
    try {
      const [user] = await this.db.delete(users).where(eq(users.supabaseId, supabaseId)).returning();
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      this.handleError(error, 'deleteBySupabaseId');
    }
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<User> {
    try {
      const [user] = await this.db.delete(users).where(eq(users.id, id)).returning();
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Get user with tenants for authentication purposes
   */
  async findWithTenantsForAuth(supabaseId: string): Promise<{
    user: User;
    userTenants: Array<{
      id: string;
      name: string;
      isSuperUser: boolean;
    }>;
  } | null> {
    try {
      const result = await this.db
        .select({
          // User fields
          userId: users.id,
          userSupabaseId: users.supabaseId,
          userEmail: users.email,
          userName: users.name,
          userAvatar: users.avatar,
          userCreatedAt: users.createdAt,
          userUpdatedAt: users.updatedAt,
          // Tenant fields (null if user has no tenants)
          tenantId: tenants.id,
          tenantName: tenants.name,
          isSuperUser: userTenants.isSuperUser,
        })
        .from(users)
        .leftJoin(userTenants, eq(users.id, userTenants.userId))
        .leftJoin(tenants, eq(userTenants.tenantId, tenants.id))
        .where(eq(users.supabaseId, supabaseId));

      if (result.length === 0) {
        return null;
      }

      // Reconstruct the user object
      const userRow = result[0]!;
      const user: User = {
        id: userRow.userId,
        supabaseId: userRow.userSupabaseId,
        email: userRow.userEmail,
        name: userRow.userName,
        avatar: userRow.userAvatar,
        createdAt: userRow.userCreatedAt,
        updatedAt: userRow.userUpdatedAt,
      };

      // Build unique tenants list (filter out null tenants)
      const tenantMap = new Map<string, { id: string; name: string; isSuperUser: boolean }>();

      for (const row of result) {
        if (row.tenantId && row.tenantName) {
          tenantMap.set(row.tenantId, {
            id: row.tenantId,
            name: row.tenantName,
            isSuperUser: row.isSuperUser || false,
          });
        }
      }

      return {
        user,
        userTenants: Array.from(tenantMap.values()),
      };
    } catch (error) {
      this.handleError(error, 'findWithTenantsForAuth');
    }
  }

  /**
   * Find users by tenant ID
   */
  async findByTenant(tenantId: string): Promise<(UserTenant & { user: User })[]> {
    try {
      const result = await this.db
        .select()
        .from(userTenants)
        .innerJoin(users, eq(userTenants.userId, users.id))
        .where(eq(userTenants.tenantId, tenantId));

      return result.map((row) => ({
        ...row.user_tenants,
        user: row.users,
      }));
    } catch (error) {
      this.handleError(error, 'findByTenant');
    }
  }
}