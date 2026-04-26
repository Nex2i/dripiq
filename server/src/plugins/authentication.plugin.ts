import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ForbiddenError } from '@/exceptions/error';
import { logger } from '@/libs/logger';
import { supabase } from '@/libs/supabase.client';
import { UserService } from '@/modules/user.service';
import { RoleService } from '@/modules/role.service';
import { TenantService } from '@/modules/tenant.service';
import { TenantDomainMappingService } from '@/modules/tenant-domain-mapping.service';
import { getDecodedJwt, isTokenExpired } from '@/libs/jwt';
import { authCache } from '@/cache/AuthCacheRedis';

export interface IUser {
  id: string; // Database user ID
  supabaseId: string; // Supabase user ID
  email: string; // Supabase user email
  name?: string; // Supabase user name
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: IUser;
  tenantId: string; // Primary/current tenant ID (automatically determined)
  userTenants: Array<{
    id: string;
    name: string;
    isSuperUser: boolean;
  }>;
  // Add a flag to indicate tenant access has been validated
  tenantAccessValidated: boolean;
}

export default fastifyPlugin(
  async (fastify: FastifyInstance) => {
    const resolveSupabaseUser = async (
      token: string
    ): Promise<{ supabaseUser: SupabaseUser; supabaseUserId: string }> => {
      const {
        data: { user: supabaseUser },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !supabaseUser) {
        logger.warn(`Supabase auth.getUser error: ${error?.message}`);
        throw new ForbiddenError(`Invalid Token: ${error?.message || 'User not found'}`);
      }

      return {
        supabaseUser,
        supabaseUserId: supabaseUser.id,
      };
    };

    const resolveDbUserWithTenants = async (
      token: string,
      initialSupabaseUserId: string,
      initialSupabaseUser: SupabaseUser | null
    ) => {
      let dbResult = await UserService.getUserWithTenantsForAuth(initialSupabaseUserId).catch(
        () => null
      );
      if (dbResult) {
        return dbResult;
      }

      const resolvedSupabase =
        initialSupabaseUser && initialSupabaseUser.id === initialSupabaseUserId
          ? { supabaseUser: initialSupabaseUser, supabaseUserId: initialSupabaseUserId }
          : await resolveSupabaseUser(token);

      const { supabaseUser, supabaseUserId } = resolvedSupabase;
      const email = supabaseUser.email?.trim().toLowerCase();
      if (!email) {
        throw new ForbiddenError('Authenticated SSO user does not have an email address');
      }

      const domain = TenantDomainMappingService.getDomainFromEmail(email);
      const mapping = await TenantDomainMappingService.findMappingByDomain(domain);
      if (!mapping) {
        throw new ForbiddenError(
          'SSO domain is not mapped to a tenant. Complete registration first.'
        );
      }

      const existingUserByEmail = await UserService.findUserByEmail(email);
      let dbUser = existingUserByEmail;
      let previousSupabaseId: string | null = null;

      if (dbUser && dbUser.supabaseId !== supabaseUserId) {
        previousSupabaseId = dbUser.supabaseId;
        dbUser = await UserService.updateUserSupabaseId(dbUser.id, supabaseUserId);
      }

      if (!dbUser) {
        const displayName =
          supabaseUser.user_metadata?.full_name ||
          supabaseUser.user_metadata?.name ||
          supabaseUser.user_metadata?.display_name ||
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
        throw new ForbiddenError('No default role configured for SSO provisioning');
      }

      await TenantService.addUserToTenant(dbUser.id, mapping.tenantId, defaultSsoRole.id, false);
      await authCache.clear(supabaseUserId);
      if (previousSupabaseId && previousSupabaseId !== supabaseUserId) {
        await authCache.clear(previousSupabaseId);
      }

      dbResult = await UserService.getUserWithTenantsForAuth(supabaseUserId).catch(() => null);
      if (!dbResult) {
        throw new ForbiddenError('User not found in database');
      }

      return dbResult;
    };

    /**
     * Enhanced authentication prehandler - validates JWT, attaches user, and determines tenant context
     * Optimized with caching and single database query
     */
    const authPrehandler = async (request: FastifyRequest, _reply: FastifyReply) => {
      const authPrehandlerStart = process.hrtime();
      try {
        const authHeader = request.headers?.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new ForbiddenError(
            'No or invalid Authorization Header format. Expected Bearer token.'
          );
        }

        const token = authHeader.substring('Bearer '.length);

        if (!token) {
          throw new ForbiddenError('No token provided in Authorization Header.');
        }

        let cachedToken = await authCache.getToken(token);

        let supabaseUserId: string | null = null;
        let supabaseUser: SupabaseUser | null = null;

        if (!cachedToken || isTokenExpired(token)) {
          await authCache.clearToken(token);
          await authCache.setToken(token);

          const supabaseGetUserStart = process.hrtime();
          // Validate JWT with Supabase
          const resolvedSupabase = await resolveSupabaseUser(token);
          supabaseUser = resolvedSupabase.supabaseUser;
          supabaseUserId = resolvedSupabase.supabaseUserId;

          const supabaseGetUserEnd = process.hrtime(supabaseGetUserStart);
          const supabaseGetUserDurationMicroSeconds =
            supabaseGetUserEnd[0] * 1e6 + supabaseGetUserEnd[1] / 1e3;
          logger.info(`supabaseGetUser took ${supabaseGetUserDurationMicroSeconds}μs`, {
            supabaseGetUserStart: supabaseGetUserStart[0] * 1e6 + supabaseGetUserStart[1] / 1e3,
            supabaseGetUserEnd: supabaseGetUserEnd[0] * 1e6 + supabaseGetUserEnd[1] / 1e3,
          });
        } else {
          supabaseUserId = getDecodedJwt(token).sub as string;
        }

        // Check cache first
        let userData = await authCache.get(supabaseUserId);

        if (!userData) {
          const dbResultStart = process.hrtime();
          // Cache miss - fetch from database with single optimized query
          const dbResult = await resolveDbUserWithTenants(token, supabaseUserId, supabaseUser);
          const dbResultEnd = process.hrtime(dbResultStart);
          const dbResultDurationMicroSeconds = dbResultEnd[0] * 1e6 + dbResultEnd[1] / 1e3;
          logger.info(`dbResult took ${dbResultDurationMicroSeconds}μs`, {
            dbResultStart: dbResultStart[0] * 1e6 + dbResultStart[1] / 1e3,
            dbResultEnd: dbResultEnd[0] * 1e6 + dbResultEnd[1] / 1e3,
            dbResultDurationMicroSeconds,
          });

          if (dbResult.userTenants.length === 0) {
            throw new ForbiddenError('User is not associated with any tenant');
          }

          userData = {
            user: {
              id: dbResult.user.id,
              supabaseId: dbResult.user.supabaseId,
              email: dbResult.user.email,
              name: dbResult.user.name || undefined,
            } as IUser,
            userTenants: dbResult.userTenants,
          };

          // Cache the result
          await authCache.set(supabaseUserId, userData);

          logger.debug(
            `Authentication cache miss for user ${userData.user.id} - data loaded from DB`
          );
        } else {
          logger.debug(`Authentication cache hit for user ${userData.user.id}`);
        }

        // Use the first tenant as the primary tenant (or we could add logic for default tenant)
        const primaryTenant = userData.userTenants[0]!; // Safe because we checked length > 0

        // Attach user and tenant information to the request
        const authenticatedRequest = request as AuthenticatedRequest;
        authenticatedRequest.user = userData.user;
        authenticatedRequest.tenantId = primaryTenant.id;
        authenticatedRequest.userTenants = userData.userTenants;
        // Mark tenant access as validated to avoid redundant checks
        authenticatedRequest.tenantAccessValidated = true;

        logger.debug(
          `User ${userData.user.id} authenticated with primary tenant: ${primaryTenant.id}`
        );
      } catch (error: any) {
        logger.warn(`authPrehandler Error: ${error.message || 'Unknown auth error'}`, {
          error: error instanceof Error ? error.stack : JSON.stringify(error),
          requestUrl: request.url,
          authHeaderProvided: !!request.headers?.authorization,
        });

        // Ensure reply is sent for errors thrown by the prehandler
        // The 'ForbiddenError' should ideally be handled by a global error handler
        // that sets the correct status code. If not, set it here.
        const errorMessage = error.message || 'Authentication failed.';

        // If a global error handler is configured to catch these and send replies,
        // re-throwing might be enough. Otherwise, explicitly send reply.
        // For now, let's assume a global handler will catch and reply.
        if (error instanceof ForbiddenError) {
          throw error; // Re-throw custom error to be caught by global error handler
        } else {
          // For unexpected errors, wrap them or throw a generic ForbiddenError
          throw new ForbiddenError(errorMessage);
        }
      }

      const authPrehandlerEnd = process.hrtime(authPrehandlerStart);
      const authPrehandlerDurationMicroSeconds =
        authPrehandlerEnd[0] * 1e6 + authPrehandlerEnd[1] / 1e3;
      logger.info(`authPrehandler took ${authPrehandlerDurationMicroSeconds}μs`, {
        authPrehandlerStart: authPrehandlerStart[0] * 1e6 + authPrehandlerStart[1] / 1e3,
        authPrehandlerEnd: authPrehandlerEnd[0] * 1e6 + authPrehandlerEnd[1] / 1e3,
        authPrehandlerDurationMicroSeconds,
      });
    };

    // Decorate fastify instance with authentication prehandler and cache utilities
    fastify.decorate('authPrehandler', authPrehandler);
    fastify.decorate('authCache', {
      clear: authCache.clear.bind(authCache),
      getStats: authCache.getStats.bind(authCache),
      refresh: authCache.refresh.bind(authCache),
    });
  },
  {
    name: 'authentication',
  }
);
