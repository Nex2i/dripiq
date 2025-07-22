import { eq } from 'drizzle-orm';
import { db, users, User, NewUser, UserTenant, userTenants, tenants } from '@/db';
import { validateUserTenantAccess } from '@/utils/tenantValidation';

export interface CreateUserData {
  supabaseId: string;
  email: string;
  name?: string;
  avatar?: string;
}

export class UserService {
  /**
   * Creates a new user in the database.
   * If a user with the same Supabase ID already exists, it returns the existing user.
   * @param userData - The data for the new user.
   * @returns A promise that resolves to the created or existing user.
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
   * Retrieves a user by their Supabase ID.
   * @param supabaseId - The Supabase ID of the user.
   * @returns A promise that resolves to the user object or null if not found.
   */
  static async getUserBySupabaseId(supabaseId: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1);

    return result[0] || null;
  }

  /**
   * Retrieves a user by their email address.
   * @param email - The email address of the user.
   * @returns A promise that resolves to the user object or null if not found.
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

    return result[0] || null;
  }

  /**
   * Retrieves a user by their internal database ID.
   * @param id - The internal ID of the user.
   * @returns A promise that resolves to the user object or null if not found.
   */
  static async getUserById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

    return result[0] || null;
  }

  /**
   * Updates a user's data based on their Supabase ID.
   * @param supabaseId - The Supabase ID of the user to update.
   * @param updateData - An object containing the fields to update.
   * @returns A promise that resolves to the updated user object.
   * @throws Throws an error if the user is not found.
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
   * Deletes a user from the database based on their Supabase ID.
   * @param supabaseId - The Supabase ID of the user to delete.
   * @returns A promise that resolves to the deleted user object.
   * @throws Throws an error if the user is not found.
   */
  static async deleteUser(supabaseId: string): Promise<User> {
    const [user] = await db.delete(users).where(eq(users.supabaseId, supabaseId)).returning();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Retrieves a user and their associated tenants in a single, optimized query.
   * This method is primarily used for authentication purposes.
   * @param supabaseId - The Supabase ID of the user.
   * @returns A promise that resolves to an object containing the user and their tenants, or null if the user is not found.
   */
  static async getUserWithTenantsForAuth(supabaseId: string): Promise<{
    user: User;
    userTenants: Array<{
      id: string;
      name: string;
      isSuperUser: boolean;
    }>;
  } | null> {
    // Single query to get user and all their tenants with JOIN
    const result = await db
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
  }

  /**
   * Retrieves all users associated with a specific tenant.
   * It also validates that the user making the request has access to that tenant.
   * @param requestingUserId - The ID of the user making the request, used for validation.
   * @param tenantId - The ID of the tenant for which to retrieve users.
   * @returns A promise that resolves to an array of user-tenant objects, with the full user object nested.
   */
  static async getUsersByTenant(
    requestingUserId: string,
    tenantId: string
  ): Promise<(UserTenant & { user: User })[]> {
    // Validate requesting user has access to this tenant
    await validateUserTenantAccess(requestingUserId, tenantId);

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
