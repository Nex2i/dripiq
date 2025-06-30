import { eq, and, not } from 'drizzle-orm';
import {
  db,
  users,
  userTenants,
  tenants,
  roles,
  User,
  NewUser,
  UserTenant,
  NewUserTenant,
  Role,
} from '@/db';
import { supabase } from '@/libs/supabaseClient';
import { UserService } from './user.service';
import { TenantService } from './tenant.service';
import { RoleService } from './role.service';

export interface InviteUserData {
  email: string;
  name?: string;
  roleId: string;
  tenantId: string;
}

export interface UserWithRole extends User {
  role: Role;
  tenantId: string;
  isSuperUser: boolean;
}

export interface TenantUserData {
  users: UserWithRole[];
  totalUsers: number;
}

export class UserManagementService {
  /**
   * Get all users in a tenant with their roles
   */
  static async getTenantUsers(tenantId: string): Promise<TenantUserData> {
    const result = await db
      .select({
        user: users,
        userTenant: userTenants,
        role: roles,
      })
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(eq(userTenants.tenantId, tenantId));

    const usersWithRoles: UserWithRole[] = result.map((row) => ({
      ...row.user,
      role: row.role,
      tenantId: row.userTenant.tenantId,
      isSuperUser: row.userTenant.isSuperUser,
    }));

    return {
      users: usersWithRoles,
      totalUsers: usersWithRoles.length,
    };
  }

  /**
   * Invite a new user to a tenant
   */
  static async inviteUser(
    inviteData: InviteUserData
  ): Promise<{ message: string; tempPassword?: string }> {
    const { email, name, roleId, tenantId } = inviteData;

    // Check if user already exists in the system
    let existingUser = await UserService.getUserByEmail(email);

    if (existingUser) {
      // Check if user is already in this tenant
      const existingMembership = await db
        .select()
        .from(userTenants)
        .where(and(eq(userTenants.userId, existingUser.id), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      if (existingMembership.length > 0) {
        throw new Error('User is already a member of this tenant');
      }

      // Add existing user to tenant with new role
      await TenantService.addUserToTenant(existingUser.id, tenantId, false);

      // Update the user's role
      await this.updateUserRole(existingUser.id, tenantId, roleId);

      return {
        message: 'Existing user has been added to the tenant successfully',
      };
    }

    // Generate temporary password for new user
    const tempPassword = this.generateTempPassword();

    try {
      // Create user in Supabase
      const { data: supabaseAuth, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email for invited users
      });

      if (signUpError || !supabaseAuth.user) {
        throw new Error(`Failed to create user in Supabase: ${signUpError?.message}`);
      }

      // Create user in our database
      const newUser = await UserService.createUser({
        supabaseId: supabaseAuth.user.id,
        email,
        name,
      });

      // Add user to tenant
      await TenantService.addUserToTenant(newUser.id, tenantId, false);

      // Assign role to user
      await this.updateUserRole(newUser.id, tenantId, roleId);

      return {
        message: 'User invited successfully',
        tempPassword,
      };
    } catch (error: any) {
      throw new Error(`Failed to invite user: ${error.message}`);
    }
  }

  /**
   * Update user role in a tenant
   */
  static async updateUserRole(
    userId: string,
    tenantId: string,
    roleId: string
  ): Promise<UserWithRole> {
    const [updatedMembership] = await db
      .update(userTenants)
      .set({
        roleId,
        updatedAt: new Date(),
      })
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .returning();

    if (!updatedMembership) {
      throw new Error('User not found in tenant');
    }

    // Get user with updated role
    const result = await db
      .select({
        user: users,
        userTenant: userTenants,
        role: roles,
      })
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1);

    if (!result[0]) {
      throw new Error('Failed to retrieve updated user');
    }

    return {
      ...result[0].user,
      role: result[0].role,
      tenantId: result[0].userTenant.tenantId,
      isSuperUser: result[0].userTenant.isSuperUser,
    };
  }

  /**
   * Remove user from tenant
   */
  static async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    // Check if user is a super user
    const membership = await db
      .select()
      .from(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1);

    if (!membership[0]) {
      throw new Error('User not found in tenant');
    }

    if (membership[0].isSuperUser) {
      // Check if there are other super users
      const otherSuperUsers = await db
        .select()
        .from(userTenants)
        .where(
          and(
            eq(userTenants.tenantId, tenantId),
            eq(userTenants.isSuperUser, true),
            not(eq(userTenants.userId, userId))
          )
        );

      if (otherSuperUsers.length === 0) {
        throw new Error('Cannot remove the last super user from tenant');
      }
    }

    await db
      .delete(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)));
  }

  /**
   * Deactivate/activate user
   */
  static async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Get user details with role in specific tenant
   */
  static async getUserInTenant(userId: string, tenantId: string): Promise<UserWithRole | null> {
    const result = await db
      .select({
        user: users,
        userTenant: userTenants,
        role: roles,
      })
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .innerJoin(roles, eq(userTenants.roleId, roles.id))
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    return {
      ...result[0].user,
      role: result[0].role,
      tenantId: result[0].userTenant.tenantId,
      isSuperUser: result[0].userTenant.isSuperUser,
    };
  }

  /**
   * Check if user can invite other users
   */
  static async canUserInvite(userId: string, tenantId: string): Promise<boolean> {
    return await RoleService.userHasPermission(userId, tenantId, 'users:invite');
  }

  /**
   * Check if user can manage other users
   */
  static async canUserManage(userId: string, tenantId: string): Promise<boolean> {
    const hasUpdate = await RoleService.userHasPermission(userId, tenantId, 'users:update');
    const hasDelete = await RoleService.userHasPermission(userId, tenantId, 'users:delete');
    const hasDeactivate = await RoleService.userHasPermission(userId, tenantId, 'users:deactivate');

    return hasUpdate || hasDelete || hasDeactivate;
  }

  /**
   * Generate temporary password
   */
  private static generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one uppercase, one lowercase, one number, one special char
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

    // Add 8 more random characters
    for (let i = 0; i < 8; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
