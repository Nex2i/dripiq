import { db } from '@/db';
import { 
  users, 
  userTenants, 
  roles,
  NewUser, 
  NewUserTenant,
  User,
  UserTenant,
  Role
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface InviteUserData {
  user: NewUser;
  roleId: string;
  isSuperUser?: boolean;
}

export interface InviteUserResult {
  user: User;
  userTenant: UserTenant;
  role: Role;
  wasUserCreated: boolean; // true if user was created, false if existing user was used
}

export interface BulkInviteData {
  invitations: InviteUserData[];
  tenantId: string;
}

export interface BulkInviteResult {
  results: InviteUserResult[];
  errors: { index: number; email: string; error: string }[];
}

export class UserInvitationTransactionRepository {
  /**
   * Invite a user to a tenant (create user if doesn't exist, create user-tenant relationship)
   */
  async inviteUserToTenant(
    tenantId: string,
    data: InviteUserData
  ): Promise<InviteUserResult> {
    return await db.transaction(async (tx) => {
      // Check if user already exists by email
      const existingUsers = await tx
        .select()
        .from(users)
        .where(eq(users.email, data.user.email))
        .limit(1);

      let user: User;
      let wasUserCreated = false;

      if (existingUsers.length > 0) {
        // User exists, use existing user
        const existingUser = existingUsers[0];
        if (!existingUser) {
          throw new Error('Existing user is undefined');
        }
        user = existingUser;
      } else {
        // Create new user
        const [createdUser] = await tx.insert(users).values(data.user).returning();
        if (!createdUser) {
          throw new Error('Failed to create user');
        }
        user = createdUser;
        wasUserCreated = true;
      }

      // Check if user-tenant relationship already exists
      const existingUserTenant = await tx
        .select()
        .from(userTenants)
        .where(and(eq(userTenants.userId, user.id), eq(userTenants.tenantId, tenantId)))
        .limit(1);

      if (existingUserTenant.length > 0) {
        throw new Error('User is already associated with this tenant');
      }

      // Get role information
      const roleResults = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, data.roleId))
        .limit(1);

      if (roleResults.length === 0) {
        throw new Error('Role not found');
      }

      const role = roleResults[0];

      // Create user-tenant relationship
      const userTenantData: NewUserTenant = {
        userId: user.id,
        tenantId,
        roleId: data.roleId,
        isSuperUser: data.isSuperUser || false,
        status: 'pending',
        invitedAt: new Date(),
      };

      const [userTenant] = await tx.insert(userTenants).values(userTenantData).returning();
      
      if (!userTenant) {
        throw new Error('Failed to create user-tenant relationship');
      }
      
      if (!role) {
        throw new Error('Role is undefined');
      }

      return {
        user,
        userTenant,
        role,
        wasUserCreated,
      };
    });
  }

  /**
   * Accept invitation (mark user-tenant as active and set accepted timestamp)
   */
  async acceptInvitation(
    userId: string,
    tenantId: string,
    updateUserData?: Partial<Pick<NewUser, 'name' | 'avatar'>>
  ): Promise<{
    user: User;
    userTenant: UserTenant;
  }> {
    return await db.transaction(async (tx) => {
      // Update user if data provided
      let user: User;
      if (updateUserData) {
        const [updatedUser] = await tx
          .update(users)
          .set(updateUserData)
          .where(eq(users.id, userId))
          .returning();
        if (!updatedUser) {
          throw new Error('Failed to update user');
        }
        user = updatedUser;
      } else {
        const [existingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!existingUser) {
          throw new Error('User not found');
        }
        user = existingUser;
      }

      // Update user-tenant status
      const [userTenant] = await tx
        .update(userTenants)
        .set({
          status: 'active',
          acceptedAt: new Date(),
        })
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .returning();

      if (!userTenant) {
        throw new Error('User-tenant relationship not found');
      }

      return { user, userTenant };
    });
  }

  /**
   * Bulk invite multiple users to a tenant
   */
  async bulkInviteUsersToTenant(
    data: BulkInviteData
  ): Promise<BulkInviteResult> {
    return await db.transaction(async (tx) => {
      const results: InviteUserResult[] = [];
      const errors: { index: number; email: string; error: string }[] = [];

      for (let i = 0; i < data.invitations.length; i++) {
        try {
          const invitation = data.invitations[i];
          
          if (!invitation) {
            throw new Error(`Invitation at index ${i} is undefined`);
          }
          
          // Check if user already exists by email
          const existingUsers = await tx
            .select()
            .from(users)
            .where(eq(users.email, invitation.user.email))
            .limit(1);

          let user: User;
          let wasUserCreated = false;

          if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            if (!existingUser) {
              throw new Error('Existing user is undefined');
            }
            user = existingUser;
          } else {
            const [createdUser] = await tx.insert(users).values(invitation.user).returning();
            if (!createdUser) {
              throw new Error('Failed to create user');
            }
            user = createdUser;
            wasUserCreated = true;
          }

          // Check if user-tenant relationship already exists
          const existingUserTenant = await tx
            .select()
            .from(userTenants)
            .where(and(eq(userTenants.userId, user.id), eq(userTenants.tenantId, data.tenantId)))
            .limit(1);

          if (existingUserTenant.length > 0) {
            errors.push({
              index: i,
              email: invitation.user.email,
              error: 'User is already associated with this tenant',
            });
            continue;
          }

          // Get role information
          const roleResults = await tx
            .select()
            .from(roles)
            .where(eq(roles.id, invitation.roleId))
            .limit(1);

          if (roleResults.length === 0) {
            errors.push({
              index: i,
              email: invitation.user.email,
              error: 'Role not found',
            });
            continue;
          }

          const role = roleResults[0];

          // Create user-tenant relationship
          const userTenantData: NewUserTenant = {
            userId: user.id,
            tenantId: data.tenantId,
            roleId: invitation.roleId,
            isSuperUser: invitation.isSuperUser || false,
            status: 'pending',
            invitedAt: new Date(),
          };

          const [userTenant] = await tx.insert(userTenants).values(userTenantData).returning();
          
          if (!userTenant) {
            throw new Error('Failed to create user-tenant relationship');
          }
          
          if (!role) {
            throw new Error('Role is undefined');
          }

          results.push({
            user,
            userTenant,
            role,
            wasUserCreated,
          });
        } catch (error) {
          errors.push({
            index: i,
            email: data.invitations[i]?.user?.email || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    });
  }

  /**
   * Remove user from tenant (delete user-tenant relationship)
   */
  async removeUserFromTenant(
    userId: string,
    tenantId: string,
    deleteUserIfNoTenants: boolean = false
  ): Promise<{
    userTenant: UserTenant | undefined;
    userDeleted: boolean;
  }> {
    return await db.transaction(async (tx) => {
      // Delete user-tenant relationship
      const [deletedUserTenant] = await tx
        .delete(userTenants)
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .returning();

      let userDeleted = false;

      if (deleteUserIfNoTenants && deletedUserTenant) {
        // Check if user has any other tenant relationships
        const otherTenants = await tx
          .select()
          .from(userTenants)
          .where(eq(userTenants.userId, userId))
          .limit(1);

        if (otherTenants.length === 0) {
          // No other tenant relationships, delete user
          await tx.delete(users).where(eq(users.id, userId));
          userDeleted = true;
        }
      }

      return {
        userTenant: deletedUserTenant,
        userDeleted,
      };
    });
  }

  /**
   * Transfer tenant ownership (make user super user and demote others)
   */
  async transferTenantOwnership(
    newOwnerId: string,
    tenantId: string,
    currentOwnerId?: string
  ): Promise<{
    newOwner: UserTenant;
    demotedOwners: UserTenant[];
  }> {
    return await db.transaction(async (tx) => {
      // Demote all current super users
      const demotedOwners = await tx
        .update(userTenants)
        .set({ isSuperUser: false })
        .where(and(eq(userTenants.tenantId, tenantId), eq(userTenants.isSuperUser, true)))
        .returning();

      // Promote new owner
      const [newOwner] = await tx
        .update(userTenants)
        .set({ isSuperUser: true })
        .where(and(eq(userTenants.userId, newOwnerId), eq(userTenants.tenantId, tenantId)))
        .returning();

      if (!newOwner) {
        throw new Error('New owner user-tenant relationship not found');
      }

      return {
        newOwner,
        demotedOwners,
      };
    });
  }

  /**
   * Update user role for tenant
   */
  async updateUserRoleForTenant(
    userId: string,
    tenantId: string,
    newRoleId: string
  ): Promise<{
    userTenant: UserTenant;
    role: Role;
  }> {
    return await db.transaction(async (tx) => {
      // Verify role exists
      const roleResults = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, newRoleId))
        .limit(1);

      if (roleResults.length === 0) {
        throw new Error('Role not found');
      }

      const role = roleResults[0];
      
      if (!role) {
        throw new Error('Role is undefined');
      }

      // Update user-tenant role
      const [userTenant] = await tx
        .update(userTenants)
        .set({ roleId: newRoleId })
        .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
        .returning();

      if (!userTenant) {
        throw new Error('User-tenant relationship not found');
      }

      return { userTenant, role };
    });
  }
}