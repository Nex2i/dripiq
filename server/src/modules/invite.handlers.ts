import { SupabaseAdminService } from '@/modules/supabase-admin.service';
import { TenantService } from '@/modules/tenant.service';
import { UserService } from '@/modules/user.service';
import { RoleService } from '@/modules/role.service';
import { InviteService, CreateInviteData } from '@/modules/invite.service';

/**
 * Add an existing database user to a tenant
 */
export async function addExistingUserToTenant(
  existingDbUser: any,
  inviteData: CreateInviteData,
  tenantId: string
) {
  const role = await RoleService.getRoleByName(inviteData.role);
  if (!role) {
    throw new Error('Invalid role specified');
  }

  await TenantService.addUserToTenant(existingDbUser.id, tenantId, role.id, false);

  // Update user's name if provided and different
  if (inviteData.firstName && inviteData.firstName !== existingDbUser.name) {
    const fullName = inviteData.lastName
      ? `${inviteData.firstName} ${inviteData.lastName}`
      : inviteData.firstName;

    await UserService.updateUser(existingDbUser.supabaseId, {
      supabaseId: existingDbUser.supabaseId,
      email: existingDbUser.email,
      name: fullName,
    });
  }

  return {
    id: existingDbUser.id,
    email: existingDbUser.email,
    name: existingDbUser.name,
    role: inviteData.role,
    addedDirectly: true,
  };
}

/**
 * Create a user record in our database from an existing Supabase user
 */
export async function createUserFromSupabaseAccount(
  existingSupabaseUser: any,
  inviteData: CreateInviteData,
  tenantId: string
) {
  const fullName = inviteData.lastName
    ? `${inviteData.firstName} ${inviteData.lastName}`
    : inviteData.firstName;

  const newDbUser = await UserService.createUser({
    supabaseId: existingSupabaseUser.id,
    email: inviteData.email,
    name: fullName,
  });

  const role = await RoleService.getRoleByName(inviteData.role);
  if (!role) {
    throw new Error('Invalid role specified');
  }

  await TenantService.addUserToTenant(newDbUser.id, tenantId, role.id, false);

  return {
    id: newDbUser.id,
    email: newDbUser.email,
    name: newDbUser.name,
    role: inviteData.role,
    addedDirectly: true,
  };
}

/**
 * Handle the complete flow for users who already exist in Supabase
 */
export async function handleExistingSupabaseUser(
  existingSupabaseUser: any,
  inviteData: CreateInviteData,
  tenantId: string
) {
  const existingDbUser = await UserService.getUserBySupabaseId(existingSupabaseUser.id);

  if (existingDbUser) {
    // Check if they're already a member of this tenant
    const existingUserTenant = await InviteService.getUserTenant(existingDbUser.id, tenantId);

    if (existingUserTenant) {
      throw new Error('User is already a member of this workspace');
    }

    // Add existing user to tenant
    const user = await addExistingUserToTenant(existingDbUser, inviteData, tenantId);
    return {
      message: 'User has been added to the workspace directly',
      user,
    };
  } else {
    // Create user from existing Supabase account
    const user = await createUserFromSupabaseAccount(existingSupabaseUser, inviteData, tenantId);
    return {
      message: 'Existing user has been added to the workspace',
      user,
    };
  }
}

/**
 * Handle the complete new user invitation flow
 */
export async function createNewUserInvite(inviteData: CreateInviteData, tenantId: string) {
  // Use Supabase's built-in invite functionality first to get the user ID
  const redirectUrl = `${process.env.FRONTEND_ORIGIN}/setup-password`;
  const supabaseUser = await SupabaseAdminService.inviteUserByEmail({
    email: inviteData.email,
    redirectTo: redirectUrl,
    data: {
      tenantId: tenantId,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      role: inviteData.role,
    },
  });

  // Get the role ID for the invite data
  const role = await RoleService.getRoleByName(inviteData.role);
  if (!role) {
    throw new Error('Invalid role specified');
  }

  // Create the user and user-tenant relationship immediately with the Supabase ID
  const { userTenant } = await InviteService.createInvite(
    {
      ...inviteData,
      role: role.id, // Pass role ID instead of role name
    },
    supabaseUser.id
  );

  return {
    message: 'User has been invited and account created',
    invite: {
      id: userTenant.id,
      email: inviteData.email,
      role: inviteData.role,
      status: userTenant.status,
      invitedAt: userTenant.invitedAt,
    },
  };
}
