import { db, userTenants, users, User, NewUser, UserTenant, NewUserTenant } from '@/db';
import { eq, and, desc } from 'drizzle-orm';

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
}

export class InviteService {
  /**
   * Create a new user invitation by immediately creating the user and tenant relationship
   */
  static async createInvite(
    data: CreateInviteData,
    supabaseId: string
  ): Promise<{ userTenant: UserTenant; token: string }> {
    // Check if email already exists in this tenant
    const existingUserTenant = await db
      .select()
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(and(eq(userTenants.tenantId, data.tenantId), eq(users.email, data.email)))
      .limit(1);

    if (existingUserTenant.length > 0) {
      throw new Error('User with this email is already a member of this workspace');
    }

    // Create user immediately
    const fullName = data.lastName ? `${data.firstName} ${data.lastName}` : data.firstName;

    const newUser: NewUser = {
      supabaseId: supabaseId,
      email: data.email,
      name: fullName,
    };

    const [user] = await db.insert(users).values(newUser).returning();

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

    const [userTenant] = await db.insert(userTenants).values(newUserTenant).returning();

    if (!userTenant) {
      throw new Error('Failed to create user-tenant relationship');
    }

    // Return user ID as token for password setup
    return { userTenant, token: user.supabaseId };
  }

  /**
   * Get all users for a tenant
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

    // Get all users for this tenant
    const tenantUsersQuery = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: userTenants.status,
        invitedAt: userTenants.invitedAt,
        acceptedAt: userTenants.acceptedAt,
        createdAt: userTenants.createdAt,
        roleId: userTenants.roleId,
      })
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(eq(userTenants.tenantId, tenantId))
      .orderBy(desc(userTenants.createdAt));

    // Transform to UserWithInviteInfo format
    const allUsers: UserWithInviteInfo[] = tenantUsersQuery.map((ut) => {
      const [firstName, ...lastNameParts] = (ut.name || '').split(' ');
      return {
        id: ut.id,
        firstName: firstName || undefined,
        lastName: lastNameParts.length > 0 ? lastNameParts.join(' ') : undefined,
        email: ut.email,
        role: ut.roleId, // This should be resolved to role name in a real app
        status: ut.status as 'pending' | 'active',
        invitedAt: ut.invitedAt || undefined,
        lastLogin: ut.acceptedAt || undefined,
        source: 'user_tenant' as const,
      };
    });

    // Sort by status (pending first), then by role, then by email
    allUsers.sort((a, b) => {
      if (a.status !== b.status) {
        const statusOrder = { pending: 0, active: 1 };
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
   * Verify invitation token (using Supabase ID)
   */
  static async verifyInviteToken(token: string): Promise<UserTenant | null> {
    const [userTenant] = await db
      .select()
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(and(eq(users.supabaseId, token), eq(userTenants.status, 'pending')))
      .limit(1);

    return userTenant?.user_tenants || null;
  }

  /**
   * Activate user account (when they complete password setup)
   */
  static async activateUser(token: string): Promise<UserTenant> {
    const userTenant = await this.verifyInviteToken(token);

    if (!userTenant) {
      throw new Error('Invalid or already activated invitation token');
    }

    // Update user-tenant status to active
    const [updatedUserTenant] = await db
      .update(userTenants)
      .set({
        status: 'active',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userTenants.id, userTenant.id))
      .returning();

    if (!updatedUserTenant) {
      throw new Error('Failed to activate user');
    }

    return updatedUserTenant;
  }

  /**
   * Resend invitation (update user and send new setup email)
   */
  static async resendInvite(
    userId: string,
    tenantId: string
  ): Promise<{ userTenant: UserTenant; token: string }> {
    const [userTenant] = await db
      .select()
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId),
          eq(userTenants.status, 'pending')
        )
      )
      .limit(1);

    if (!userTenant) {
      throw new Error('User invitation not found or already activated');
    }

    // Update invite timestamp
    const [updatedUserTenant] = await db
      .update(userTenants)
      .set({
        invitedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userTenants.id, userTenant.user_tenants.id))
      .returning();

    if (!updatedUserTenant) {
      throw new Error('Failed to update invitation');
    }

    // Return Supabase ID as token
    return { userTenant: updatedUserTenant, token: userTenant.users.supabaseId };
  }

  /**
   * Remove user from tenant
   */
  static async removeUser(userId: string, tenantId: string): Promise<void> {
    const result = await db
      .delete(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .returning({ id: userTenants.id });

    if (result.length === 0) {
      throw new Error('User not found in this workspace');
    }
  }

  /**
   * Get user-tenant relationship by user and tenant ID
   */
  static async getUserTenant(userId: string, tenantId: string): Promise<UserTenant | null> {
    const result = await db
      .select()
      .from(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update user-tenant relationship with Supabase user ID
   */
  static async updateUserTenantWithSupabaseId(
    userId: string,
    tenantId: string,
    supabaseId: string
  ): Promise<UserTenant> {
    // First update the user record
    await db
      .update(users)
      .set({
        supabaseId: supabaseId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Get the updated user-tenant relationship
    const [userTenant] = await db
      .select()
      .from(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1);

    if (!userTenant) {
      throw new Error('User-tenant relationship not found');
    }

    return userTenant;
  }
}
