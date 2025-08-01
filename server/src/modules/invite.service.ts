import { userRepository, userTenantRepository, roleRepository } from '@/repositories';
import { NewUser, UserTenant, NewUserTenant } from '@/db/schema';

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

/**
 * Create an invite for a user to join a tenant
 */
export const createInvite = async (inviteData: CreateInviteData, requestingUserId?: string): Promise<UserTenant> => {
  const { tenantId, email, firstName, lastName, role } = inviteData;

  // Check if user already exists
  let user = await userRepository.findByEmail(email);
  
  if (!user) {
    // Create new user
    const newUserData: NewUser = {
      email,
      name: firstName + (lastName ? ` ${lastName}` : ''),
      supabaseId: '', // Will be set when they actually sign up
    };
    user = await userRepository.create(newUserData);
  }

  // Get role by name
  const roleRecord = await roleRepository.findByName(role, tenantId, requestingUserId);
  if (!roleRecord) {
    throw new Error(`Role '${role}' not found`);
  }

  // Create user-tenant relationship
  const userTenantData: NewUserTenant = {
    userId: user.id,
    tenantId,
    roleId: roleRecord.id,
    status: 'pending',
    invitedAt: new Date(),
  };

  return await userTenantRepository.create(userTenantData, tenantId, requestingUserId);
};

/**
 * Get all pending invites for a tenant
 */
export const getPendingInvites = async (tenantId: string, userId?: string): Promise<UserWithInviteInfo[]> => {
  const pendingUserTenants = await userTenantRepository.findByTenantWithDetails(tenantId, userId);
  
  return pendingUserTenants
    .filter(ut => ut.status === 'pending')
    .map(ut => ({
      id: ut.user.id,
      firstName: ut.user.name ? ut.user.name.split(' ')[0] : undefined,
      lastName: ut.user.name ? ut.user.name.split(' ').slice(1).join(' ') || undefined : undefined,
      email: ut.user.email,
      role: ut.role.name,
      status: 'pending' as const,
      invitedAt: ut.invitedAt || undefined,
      lastLogin: undefined,
      source: 'user_tenant' as const,
    }));
};

/**
 * Accept an invite (when user completes registration)
 */
export const acceptInvite = async (userId: string, tenantId: string): Promise<UserTenant> => {
  return await userTenantRepository.updateStatus(userId, tenantId, 'active');
};

/**
 * Cancel an invite
 */
export const cancelInvite = async (userId: string, tenantId: string, requestingUserId?: string): Promise<void> => {
  const userTenant = await userTenantRepository.findByUserAndTenant(userId, tenantId);
  
  if (!userTenant) {
    throw new Error('Invite not found');
  }

  if (userTenant.status !== 'pending') {
    throw new Error('Can only cancel pending invites');
  }

  await userTenantRepository.delete(userTenant.id, tenantId, requestingUserId);
};

/**
 * Check if an invite exists for a user and tenant
 */
export const getInviteStatus = async (userId: string, tenantId: string, requestingUserId?: string): Promise<UserTenant | null> => {
  return await userTenantRepository.findByUserAndTenant(userId, tenantId);
};

/**
 * Complete user registration and update user info
 */
export const completeUserRegistration = async (
  userId: string,
  tenantId: string,
  userData: { name?: string },
  requestingUserId?: string
): Promise<void> => {
  // Update user basic info
  await userRepository.update(userId, userData);

  // Update user-tenant status to active
  await userTenantRepository.updateStatus(userId, tenantId, 'active', requestingUserId);
};

/**
 * Get role by ID for invite management
 */
export const getRoleForInvite = async (roleId: string, tenantId: string, userId?: string) => {
  return await roleRepository.findById(roleId, tenantId, userId);
};

/**
 * Update user role in a tenant
 */
export const updateUserRole = async (
  userId: string,
  tenantId: string,
  roleId: string,
  requestingUserId?: string
): Promise<UserTenant> => {
  // Verify role exists
  const role = await roleRepository.findById(roleId, tenantId, requestingUserId);
  if (!role) {
    throw new Error('Role not found');
  }

  // Verify user-tenant relationship exists
  const userTenant = await userTenantRepository.findByUserAndTenant(userId, tenantId);
  if (!userTenant) {
    throw new Error('User not found in tenant');
  }

  // Update the role
  return await userTenantRepository.update(userTenant.id, { roleId }, tenantId, requestingUserId);
};

// Export as InviteService for backward compatibility
export const InviteService = {
  createInvite,
  getPendingInvites,
  acceptInvite,
  cancelInvite,
  getInviteStatus,
  completeUserRegistration,
  getRoleForInvite,
  updateUserRole,
};