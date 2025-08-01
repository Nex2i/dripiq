import { userRepository, userTenantRepository } from '@/repositories';
import { User, NewUser, UserTenant } from '@/db/schema';
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

      return await userRepository.create(newUser);
    } catch (error: any) {
      // If user already exists (unique constraint violation), fetch and return it
      if (error.code === '23505') {
        const existingUser = await userRepository.findBySupabaseId(userData.supabaseId);

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
    return await userRepository.findBySupabaseId(supabaseId);
  }

  /**
   * Retrieves a user by their email address.
   * @param email - The email address of the user.
   * @returns A promise that resolves to the user object or null if not found.
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    return await userRepository.findByEmail(email);
  }

  /**
   * Retrieves a user by their internal database ID.
   * @param id - The internal ID of the user.
   * @returns A promise that resolves to the user object or null if not found.
   */
  static async getUserById(id: string): Promise<User | null> {
    return await userRepository.findById(id);
  }

  /**
   * Updates a user's data based on their Supabase ID.
   * @param supabaseId - The Supabase ID of the user to update.
   * @param updateData - An object containing the fields to update.
   * @returns A promise that resolves to the updated user object.
   * @throws Throws an error if the user is not found.
   */
  static async updateUser(supabaseId: string, updateData: Partial<CreateUserData>): Promise<User> {
    return await userRepository.updateBySupabaseId(supabaseId, updateData);
  }

  /**
   * Deletes a user from the database based on their Supabase ID.
   * @param supabaseId - The Supabase ID of the user to delete.
   * @returns A promise that resolves to the deleted user object.
   * @throws Throws an error if the user is not found.
   */
  static async deleteUser(supabaseId: string): Promise<User> {
    return await userRepository.deleteBySupabaseId(supabaseId);
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
    return await userRepository.findWithTenantsForAuth(supabaseId);
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

    return await userRepository.findByTenant(tenantId);
  }
}
