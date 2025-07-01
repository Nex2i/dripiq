import { eq, and } from 'drizzle-orm';
import { db, userTenants } from '@/db';
import { ForbiddenError } from '@/exceptions/error';

/**
 * Validates that a user belongs to a specific tenant
 */
export async function validateUserTenantAccess(userId: string, tenantId: string): Promise<void> {
  const userTenant = await db
    .select()
    .from(userTenants)
    .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
    .limit(1)
    .then((result) => result[0]);

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
  const userTenantList = await db
    .select({ tenantId: userTenants.tenantId })
    .from(userTenants)
    .where(eq(userTenants.userId, userId));

  return userTenantList.map((ut) => ut.tenantId);
}

/**
 * Validates that a user has super user access to a specific tenant
 */
export async function validateUserSuperAccess(userId: string, tenantId: string): Promise<void> {
  const userTenant = await db
    .select()
    .from(userTenants)
    .where(
      and(
        eq(userTenants.userId, userId),
        eq(userTenants.tenantId, tenantId),
        eq(userTenants.isSuperUser, true)
      )
    )
    .limit(1)
    .then((result) => result[0]);

  if (!userTenant) {
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
  const { users } = await import('@/db');
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseId, supabaseUserId))
    .limit(1)
    .then((result) => result[0]);

  if (!user) {
    throw new ForbiddenError('User not found in database');
  }

  // Then validate tenant access
  await validateUserTenantAccess(user.id, tenantId);

  return user.id;
}
