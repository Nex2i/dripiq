import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ForbiddenError } from '@/exceptions/error';
import { logger } from '@/libs/logger';
import { supabase } from '@/libs/supabaseClient';
import { UserService } from '@/modules/user.service';
import { TenantService } from '@/modules/tenant.service';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string; // Database user ID
    supabaseId: string;
    email: string;
    name?: string;
    avatar?: string;
  };
  tenantId: string; // Primary/current tenant ID (automatically determined)
  userTenants: Array<{
    id: string;
    name: string;
    isSuperUser: boolean;
  }>;
}

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  /**
   * Enhanced authentication prehandler - validates JWT, attaches user, and determines tenant context
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

      const {
        data: { user: supabaseUser },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !supabaseUser) {
        logger.warn(`Supabase auth.getUser error: ${error?.message}`, {
          requestUrl: request.url,
        });
        throw new ForbiddenError(`Invalid Token: ${error?.message || 'User not found'}`);
      }

      // Get user from database
      const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
      if (!dbUser) {
        throw new ForbiddenError('User not found in database');
      }

      // Get user's tenants to determine tenant context
      const userTenants = await TenantService.getUserTenants(dbUser.id);

      if (userTenants.length === 0) {
        throw new ForbiddenError('User is not associated with any tenant');
      }

      // Use the first tenant as the primary tenant (or we could add logic for default tenant)
      const primaryTenant = userTenants[0]!; // Safe because we checked length > 0

      // Attach user and tenant information to the request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = {
        id: dbUser.id,
        supabaseId: dbUser.supabaseId,
        email: dbUser.email,
        name: dbUser.name || undefined,
        avatar: dbUser.avatar || undefined,
      };

      authenticatedRequest.tenantId = primaryTenant.tenant.id;
      authenticatedRequest.userTenants = userTenants.map((ut) => ({
        id: ut.tenant.id,
        name: ut.tenant.name,
        isSuperUser: ut.isSuperUser,
      }));

      logger.debug(
        `User ${dbUser.id} authenticated with primary tenant: ${primaryTenant.tenant.id}`
      );
    } catch (error: any) {
      logger.warn(`authPrehandler Error: ${error.message || 'Unknown auth error'}`, {
        error: error instanceof Error ? error.stack : JSON.stringify(error),
        requestUrl: request.url,
        authHeaderProvided: !!request.headers?.authorization,
      });

      if (error instanceof ForbiddenError) {
        throw error;
      } else {
        throw new ForbiddenError(error.message || 'Authentication failed.');
      }
    }
  };

  // Decorate fastify instance with authentication prehandler
  fastify.decorate('authPrehandler', authPrehandler);
});
