import { NewUser, UserTenant, NewUserTenant } from '@/db';
import {
  roleRepository,
  userRepository,
  userTenantRepository,
  mailAccountRepository,
} from '@/repositories';
import { NotFoundError } from '@/exceptions/error';

export interface CreateInviteData {
  tenantId: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string; // Accept any role name from database
}

export interface InviteDto {
  email: string;
  firstName: string;
  lastName?: string;
  role: string; // Accept any role name from database
}

export interface UserWithInviteInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: 'pending' | 'active';
  invitedAt?: Date;
  lastLogin?: Date;
  source: 'user_tenant';
  hasConnectedPrimaryMailAccount?: boolean;
}

export class InviteService {
  /**
   * Creates a new user invitation by immediately creating the user and a pending user-tenant relationship.
   * @param data - The data for the new invitation.
   * @param supabaseId - The Supabase ID for the new user.
   * @returns A promise that resolves to an object containing the new user-tenant relationship and a token for password setup.
   * @throws Throws an error if a user with the same email already exists in the tenant.
   */
  static async createInvite(
    data: CreateInviteData,
    supabaseId: string
  ): Promise<{ userTenant: UserTenant; token: string }> {
    // Check if email already exists in this tenant
    const existingUserTenant = await userTenantRepository.userExistsInTenant(
      data.email,
      data.tenantId
    );

    if (existingUserTenant) {
      throw new Error('User with this email is already a member of this workspace');
    }

    // Create user immediately
    const fullName = data.lastName ? `${data.firstName} ${data.lastName}` : data.firstName;

    const newUser: NewUser = {
      supabaseId: supabaseId,
      email: data.email,
      name: fullName,
    };

    const user = await userRepository.create(newUser);

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Create user-tenant relationship with pending status
    const newUserTenant: NewUserTenant = {
      userId: user.id,
      tenantId: data.tenantId,
      roleId: data.role, // This should be the role ID, not role name
      status: 'pending',
      invitedAt: new Date(),
    };

    const userTenant = await userTenantRepository.create(newUserTenant);

    if (!userTenant) {
      throw new Error('Failed to create user-tenant relationship');
    }

    // Return user ID as token for password setup
    return { userTenant, token: user.supabaseId };
  }

  /**
   * Retrieves all users for a specific tenant, with pagination.
   * @param tenantId - The ID of the tenant.
   * @param page - The page number to retrieve.
   * @param limit - The number of users per page.
   * @returns A promise that resolves to an object containing the paginated list of users and pagination details.
   */
  static async getTenantUsers(
    tenantId: string,
    page = 1,
    limit = 25
  ): Promise<{
    users: UserWithInviteInfo[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Get all users for this tenant with role information
    const tenantUsersQuery = await userTenantRepository.findUsersWithDetailsForTenant(tenantId);

    // Fetch all mail accounts and build a lookup for users with connected primary accounts
    const allUserIds = tenantUsersQuery.map((ut) => ut.userId);
    const userMailAccounts = await Promise.all(
      allUserIds.map(async (userId) => {
        try {
          const primaryAccount = await mailAccountRepository.findPrimaryByUserId(userId);
          return {
            userId,
            hasConnectedPrimary: !primaryAccount.disconnectedAt && !primaryAccount.reauthRequired,
          };
        } catch {
          return { userId, hasConnectedPrimary: false };
        }
      })
    );
    const connectedUserIds = new Set(
      userMailAccounts.filter((u) => u.hasConnectedPrimary).map((u) => u.userId)
    );

    // Transform to UserWithInviteInfo format
    const allUsers: UserWithInviteInfo[] = tenantUsersQuery.map((ut) => {
      const [firstName, ...lastNameParts] = (ut.user?.name || '').split(' ');
      return {
        id: ut.userId,
        firstName: firstName || undefined,
        lastName: lastNameParts.length > 0 ? lastNameParts.join(' ') : undefined,
        email: ut.user?.email || '',
        role: ut.role?.name || 'Unknown', // Now returns actual role name
        status: ut.status as 'pending' | 'active',
        invitedAt: ut.invitedAt || undefined,
        lastLogin: ut.acceptedAt || undefined,
        source: 'user_tenant' as const,
        hasConnectedPrimaryMailAccount: connectedUserIds.has(ut.userId),
      };
    });

    // Sort by status (pending first), then by role, then by email
    allUsers.sort((a, b) => {
      if (a.status !== b.status) {
        const statusOrder = { pending: 0, active: 1 } as const;
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.role !== b.role) {
        return a.role.localeCompare(b.role);
      }
      return a.email.localeCompare(b.email);
    });

    // Apply pagination
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    const total = allUsers.length;
    const totalPages = Math.ceil(total / limit);

    return {
      users: paginatedUsers,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Activates a user's account by updating their user-tenant relationship status to 'active'.
   * This is typically called after a user sets their password for the first time.
   * @param supabaseId - The Supabase ID of the user to activate.
   * @returns A promise that resolves to the updated user-tenant relationship object, or null if not found.
   */
  static async activateUserBySupabaseId(supabaseId: string): Promise<UserTenant | null> {
    // Find the user by Supabase ID
    const userRecord = await userRepository.findBySupabaseId(supabaseId);

    if (!userRecord) {
      throw new NotFoundError(`User ${supabaseId} not found`);
    }

    // Find pending user-tenant relationship
    const userTenant = await userTenantRepository.findPendingByUserId(userRecord.id);

    // Update user-tenant status to active
    const updatedUserTenant = await userTenantRepository.updateStatusForTenant(
      userTenant.userId,
      userTenant.tenantId,
      'active'
    );

    return updatedUserTenant || null;
  }

  /**
   * Resends an invitation to a user by updating the invitation timestamp.
   * This would typically trigger a new setup email to be sent.
   * @param userId - The ID of the user to resend the invitation to.
   * @param tenantId - The ID of the tenant the user is being invited to.
   * @returns A promise that resolves to an object containing the updated user-tenant relationship and a token for password setup.
   * @throws Throws an error if the invitation is not found or has already been activated.
   */
  static async resendInvite(
    userId: string,
    tenantId: string
  ): Promise<{ userTenant: UserTenant; token: string }> {
    const userTenant = await userTenantRepository.findPendingByUserId(userId, tenantId);

    if (!userTenant) {
      throw new Error('User invitation not found or already activated');
    }

    // Update invite timestamp

    const updatedUserTenant = await userTenantRepository.updateById(userTenant.id, {
      invitedAt: new Date(),
    });

    if (!updatedUserTenant) {
      throw new Error('Failed to update invitation');
    }

    const user = await userRepository.findById(userTenant.userId);

    // Return Supabase ID as token
    return { userTenant: updatedUserTenant, token: user.supabaseId };
  }

  /**
   * Removes a user from a tenant by setting their user-tenant status to 'deactivated'.
   * @param userId - The ID of the user to remove.
   * @param tenantId - The ID of the tenant to remove the user from.
   * @returns A promise that resolves when the user is deactivated.
   * @throws Throws an error if the user is not found in the tenant.
   */
  static async removeUser(userId: string, tenantId: string): Promise<void> {
    await userTenantRepository.updateStatusForTenant(userId, tenantId, 'deactivated');
  }

  /**
   * Retrieves the user-tenant relationship for a specific user and tenant.
   * @param userId - The ID of the user.
   * @param tenantId - The ID of the tenant.
   * @returns A promise that resolves to the user-tenant relationship object, or null if not found.
   */
  static async getUserTenant(userId: string, tenantId: string): Promise<UserTenant> {
    return await userTenantRepository.findByUserIdForTenant(userId, tenantId);
  }

  /**
   * Updates a user-tenant relationship with a Supabase user ID.
   * @param userId - The internal ID of the user.
   * @param tenantId - The ID of the tenant.
   * @param supabaseId - The Supabase ID to associate with the user.
   * @returns A promise that resolves to the updated user-tenant relationship object.
   * @throws Throws an error if the user-tenant relationship is not found.
   */
  static async updateUserTenantWithSupabaseId(
    userId: string,
    tenantId: string,
    supabaseId: string
  ): Promise<UserTenant> {
    // First update the user record
    await userRepository.updateById(userId, {
      supabaseId: supabaseId,
    });

    // Get the updated user-tenant relationship
    const userTenant = await userTenantRepository.findByUserIdForTenant(userId, tenantId);

    if (!userTenant) {
      throw new Error('User-tenant relationship not found');
    }

    return userTenant;
  }

  /**
   * Updates a user's role within a specific tenant.
   * @param userId - The ID of the user.
   * @param tenantId - The ID of the tenant.
   * @param roleId - The new role ID to assign to the user.
   * @returns A promise that resolves to the updated user-tenant relationship object.
   * @throws Throws an error if the role ID is invalid, the user is not in the tenant, or the update fails.
   */
  static async updateUserRole(
    userId: string,
    tenantId: string,
    roleId: string
  ): Promise<UserTenant> {
    // Verify the role exists
    const role = await roleRepository.findById(roleId);
    if (!role) {
      throw new Error('Invalid role ID');
    }

    // Verify the user exists in this tenant
    const userTenant = await userTenantRepository.findByUserIdForTenant(userId, tenantId);

    if (!userTenant) {
      throw new Error('User not found in this tenant');
    }

    // Update the user's role
    const updatedUserTenant = await userTenantRepository.updateRoleForTenant(
      userTenant.id,
      tenantId,
      roleId
    );

    if (!updatedUserTenant) {
      throw new Error('Failed to update user role');
    }

    return updatedUserTenant;
  }
}
