import { eq } from 'drizzle-orm';
import { db, users, User, NewUser, UserTenant } from '@/db';

export interface CreateUserData {
  supabaseId: string;
  email: string;
  name?: string;
  avatar?: string;
}

export class UserService {
  /**
   * Create a new user in the database
   */
  static async createUser(userData: CreateUserData): Promise<User> {
    try {
      const newUser: NewUser = {
        supabaseId: userData.supabaseId,
        email: userData.email,
        name: userData.name || null,
        avatar: userData.avatar || null,
      };

      const [user] = await db.insert(users).values(newUser).returning();
      return user!;
    } catch (error: any) {
      // If user already exists (unique constraint violation), fetch and return it
      if (error.code === '23505') {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.supabaseId, userData.supabaseId))
          .limit(1)
          .then((result) => result[0]);

        if (!existingUser) {
          throw new Error('User creation failed and user not found');
        }
        return existingUser;
      }
      throw error;
    }
  }

  /**
   * Get user by Supabase ID
   */
  static async getUserBySupabaseId(supabaseId: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1);

    return result[0] || null;
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

    return result[0] || null;
  }

  /**
   * Update user data
   */
  static async updateUser(supabaseId: string, updateData: Partial<CreateUserData>): Promise<User> {
    const [user] = await db
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
  }

  /**
   * Delete user
   */
  static async deleteUser(supabaseId: string): Promise<User> {
    const [user] = await db.delete(users).where(eq(users.supabaseId, supabaseId)).returning();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Get users by tenant (with tenant access validation)
   */
  static async getUsersByTenant(
    requestingUserId: string,
    tenantId: string
  ): Promise<(UserTenant & { user: User })[]> {
    // Validate requesting user has access to this tenant
    const { validateUserTenantAccess } = await import('../utils/tenantValidation');
    await validateUserTenantAccess(requestingUserId, tenantId);

    const { userTenants } = await import('@/db');
    const result = await db
      .select()
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(eq(userTenants.tenantId, tenantId));

    return result.map((row) => ({
      ...row.user_tenants,
      user: row.users,
    }));
  }
}
