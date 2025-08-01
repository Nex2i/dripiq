import { userRepository, userTenantRepository } from '@/repositories';
import { ForbiddenError } from '@/exceptions/error';

/**
 * Validates that a user belongs to a specific tenant
 */
export async function validateUserTenantAccess(userId: string, tenantId: string): Promise<void> {
  const userTenant = await userTenantRepository.findByUserAndTenant(userId, tenantId);

  if (!userTenant) {
    throw new ForbiddenError(
      `User does not have access to tenant ${tenantId} or tenant does not exist`
    );
  }
}

/**
 * Gets all tenant IDs that a user has access to
 */
export async function getUserTenantIds(userId: string): Promise<string[]> {
  const userTenantList = await userTenantRepository.findByUser(userId);

  return userTenantList.map((ut) => ut.tenantId);
}

/**
 * Validates that a user has super user access to a specific tenant
 */
export async function validateUserSuperAccess(userId: string, tenantId: string): Promise<void> {
  const isSuperUser = await userTenantRepository.isUserSuperUser(userId, tenantId);

  if (!isSuperUser) {
    throw new ForbiddenError(
      `User does not have super user access to tenant ${tenantId} or tenant does not exist`
    );
  }
}

/**
 * Validates tenant access and returns the user's database ID
 * This function is designed to be used in route handlers
 */
export async function validateTenantAccessFromSupabaseUser(
  supabaseUserId: string,
  tenantId: string
): Promise<string> {
  // First get the user's database ID using Supabase ID
  const user = await userRepository.findBySupabaseId(supabaseUserId);

  if (!user) {
    throw new ForbiddenError('User not found in database');
  }

  // Then validate tenant access
  await validateUserTenantAccess(user.id, tenantId);

  return user.id;
}
