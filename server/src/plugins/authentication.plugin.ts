import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ForbiddenError } from '@/exceptions/error';
import { logger } from '@/libs/logger';
import { supabase } from '@/libs/supabaseClient';
import { UserService } from '@/modules/user.service';

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

// Simple in-memory cache with TTL for authentication data
interface CacheEntry {
  data: {
    user: IUser;
    userTenants: Array<{
      id: string;
      name: string;
      isSuperUser: boolean;
    }>;
  };
  expiresAt: number;
}

class AuthCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  set(supabaseId: string, data: CacheEntry['data']): void {
    this.cache.set(supabaseId, {
      data,
      expiresAt: Date.now() + this.TTL,
    });
  }

  get(supabaseId: string): CacheEntry['data'] | null {
    const entry = this.cache.get(supabaseId);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(supabaseId);
      return null;
    }

    return entry.data;
  }

  clear(supabaseId?: string): void {
    if (supabaseId) {
      this.cache.delete(supabaseId);
    } else {
      this.cache.clear();
    }
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

const authCache = new AuthCache();

// Run cleanup every 10 minutes
setInterval(
  () => {
    authCache.cleanup();
  },
  10 * 60 * 1000
);

export default fastifyPlugin(
  async (fastify: FastifyInstance) => {
    /**
     * Enhanced authentication prehandler - validates JWT, attaches user, and determines tenant context
     * Optimized with caching and single database query
     */
    const authPrehandler = async (request: FastifyRequest, _reply: FastifyReply) => {
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

        // Validate JWT with Supabase
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
          logger.warn(`Supabase auth.getUser error: ${error?.message}`, {
            requestUrl: request.url,
          });
          throw new ForbiddenError(`Invalid Token: ${error?.message || 'User not found'}`);
        }

        // Check cache first
        let userData = authCache.get(user.id);

        if (!userData) {
          // Cache miss - fetch from database with single optimized query
          const dbResult = await UserService.getUserWithTenantsForAuth(user.id);

          if (!dbResult) {
            throw new ForbiddenError('User not found in database');
          }

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
          authCache.set(user.id, userData);

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
    };

    // Decorate fastify instance with authentication prehandler and cache utilities
    fastify.decorate('authPrehandler', authPrehandler);
    fastify.decorate('authCache', {
      clear: authCache.clear.bind(authCache),
      cleanup: authCache.cleanup.bind(authCache),
    });
  },
  {
    name: 'authentication',
  }
);
