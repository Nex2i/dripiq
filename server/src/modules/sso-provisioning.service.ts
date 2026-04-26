import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/libs/supabase.client';
import { authCache } from '@/cache/AuthCacheRedis';
import { UserService } from '@/modules/user.service';
import { RoleService } from '@/modules/role.service';
import { TenantService } from '@/modules/tenant.service';
import { TenantDomainMappingService } from '@/modules/tenant-domain-mapping.service';

type UserWithTenants = NonNullable<
  Awaited<ReturnType<typeof UserService.getUserWithTenantsForAuth>>
>;

export type SsoProvisioningResult =
  | {
      status: 'invalid_session';
      message: string;
    }
  | {
      status: 'missing_email';
      message: string;
    }
  | {
      status: 'requires_registration';
      email: string;
      domain: string;
    }
  | {
      status: 'already_provisioned' | 'provisioned';
      email: string;
      domain: string;
      userWithTenants: UserWithTenants;
      tenantId: string;
    };

export class SsoProvisioningService {
  static getTokenFromAuthHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring('Bearer '.length);
  }

  static async resolveFromToken(
    token: string,
    initialSupabaseUser?: SupabaseUser | null
  ): Promise<SsoProvisioningResult> {
    const resolvedSupabaseUser = initialSupabaseUser ?? (await this.resolveSupabaseUser(token));
    if (!resolvedSupabaseUser) {
      return {
        status: 'invalid_session',
        message: 'Unable to resolve authenticated user',
      };
    }

    const supabaseUserId = resolvedSupabaseUser.id;
    const email = resolvedSupabaseUser.email?.trim().toLowerCase();
    if (!email) {
      return {
        status: 'missing_email',
        message: 'Authenticated SSO user does not have an email address',
      };
    }

    const domain = TenantDomainMappingService.getDomainFromEmail(email);

    const existingUserWithTenants = await UserService.getUserWithTenantsForAuth(
      supabaseUserId
    ).catch(() => null);
    if (existingUserWithTenants && existingUserWithTenants.userTenants.length > 0) {
      return {
        status: 'already_provisioned',
        email,
        domain,
        userWithTenants: existingUserWithTenants,
        tenantId: existingUserWithTenants.userTenants[0]!.id,
      };
    }

    const mapping = await TenantDomainMappingService.findMappingByDomain(domain);
    if (!mapping) {
      return {
        status: 'requires_registration',
        email,
        domain,
      };
    }

    const existingUserByEmail = await UserService.findUserByEmail(email);
    let dbUser = existingUserWithTenants?.user ?? existingUserByEmail;
    let previousSupabaseId: string | null = null;

    if (dbUser && dbUser.supabaseId !== supabaseUserId) {
      previousSupabaseId = dbUser.supabaseId;
      dbUser = await UserService.updateUserSupabaseId(dbUser.id, supabaseUserId);
    }

    if (!dbUser) {
      const displayName =
        resolvedSupabaseUser.user_metadata?.full_name ||
        resolvedSupabaseUser.user_metadata?.name ||
        resolvedSupabaseUser.user_metadata?.display_name ||
        undefined;

      dbUser = await UserService.createUser({
        supabaseId: supabaseUserId,
        email,
        name: displayName || undefined,
      });
    }

    const defaultSsoRole =
      (await RoleService.getRoleByName('Sales')) || (await RoleService.getRoleByName('Admin'));
    if (!defaultSsoRole) {
      throw new Error('No default role configured for SSO provisioning');
    }

    await TenantService.addUserToTenant(dbUser.id, mapping.tenantId, defaultSsoRole.id, false);
    await authCache.clear(supabaseUserId);
    if (previousSupabaseId && previousSupabaseId !== supabaseUserId) {
      await authCache.clear(previousSupabaseId);
    }

    const provisionedUserWithTenants = await UserService.getUserWithTenantsForAuth(
      supabaseUserId
    ).catch(() => null);
    if (!provisionedUserWithTenants || provisionedUserWithTenants.userTenants.length === 0) {
      throw new Error('Failed to complete SSO provisioning');
    }

    const resolvedTenant =
      provisionedUserWithTenants.userTenants.find((tenant) => tenant.id === mapping.tenantId) ||
      provisionedUserWithTenants.userTenants[0]!;

    return {
      status: 'provisioned',
      email,
      domain,
      userWithTenants: provisionedUserWithTenants,
      tenantId: resolvedTenant.id,
    };
  }

  private static async resolveSupabaseUser(token: string): Promise<SupabaseUser | null> {
    const {
      data: { user: supabaseUser },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError || !supabaseUser) {
      return null;
    }

    return supabaseUser;
  }
}
