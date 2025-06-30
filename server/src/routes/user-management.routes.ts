import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { UserService } from '@/modules/user.service';
import { UserManagementService, InviteUserData } from '@/modules/user-management.service';
import { RoleService } from '@/modules/role.service';
import { TenantService } from '@/modules/tenant.service';

const basePath = '/user-management';

// Schema definitions
const inviteUserBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  name: Type.Optional(Type.String()),
  roleId: Type.String(),
  tenantId: Type.String(),
});

const updateUserRoleBodySchema = Type.Object({
  roleId: Type.String(),
});

const tenantParamsSchema = Type.Object({
  tenantId: Type.String(),
});

const userParamsSchema = Type.Object({
  userId: Type.String(),
  tenantId: Type.String(),
});

const toggleUserStatusBodySchema = Type.Object({
  isActive: Type.Boolean(),
});

const createReadOnlyRoleBodySchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  tenantId: Type.Optional(Type.String()),
  resources: Type.Optional(Type.Array(Type.String())),
  isSystemRole: Type.Optional(Type.Boolean()),
});

export default async function UserManagement(fastify: FastifyInstance, _opts: RouteOptions) {
  // Permission check helper
  const checkPermission = async (
    request: FastifyRequest,
    tenantId: string,
    permission: string
  ): Promise<{ user: any; dbUser: any }> => {
    const supabaseUser = (request as any).user;
    if (!supabaseUser?.id) {
      throw new Error('No authenticated user found');
    }

    const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
    if (!dbUser) {
      throw new Error('User not found in database');
    }

    const hasPermission = await RoleService.userHasPermission(dbUser.id, tenantId, permission);
    if (!hasPermission) {
      throw new Error(`Insufficient permissions: ${permission} required`);
    }

    return { user: supabaseUser, dbUser };
  };

  // Invite user to tenant
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/invite`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: inviteUserBodySchema,
      tags: ['User Management'],
      summary: 'Invite User',
      description: 'Invite a new user to join a tenant with a specific role',
    },
    handler: async (request: FastifyRequest<{ Body: InviteUserData }>, reply: FastifyReply) => {
      try {
        const inviteData = request.body;

        await checkPermission(request, inviteData.tenantId, 'users:invite');

        const result = await UserManagementService.inviteUser(inviteData);

        reply.status(201).send({
          message: result.message,
          tempPassword: result.tempPassword,
        });
      } catch (error: any) {
        fastify.log.error(`Error inviting user: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 400).send({
          message: error.message.includes('permission') ? 'Access denied' : 'Failed to invite user',
          error: error.message,
        });
      }
    },
  });

  // Update user role
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/tenants/:tenantId/users/:userId/role`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: userParamsSchema,
      body: updateUserRoleBodySchema,
      tags: ['User Management'],
      summary: 'Update User Role',
      description: "Update a user's role in a specific tenant",
    },
    handler: async (
      request: FastifyRequest<{
        Params: { userId: string; tenantId: string };
        Body: { roleId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId, tenantId } = request.params;
        const { roleId } = request.body;

        await checkPermission(request, tenantId, 'roles:assign');

        const updatedUser = await UserManagementService.updateUserRole(userId, tenantId, roleId);

        reply.send({
          message: 'User role updated successfully',
          user: updatedUser,
        });
      } catch (error: any) {
        fastify.log.error(`Error updating user role: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 400).send({
          message: error.message.includes('permission')
            ? 'Access denied'
            : 'Failed to update user role',
          error: error.message,
        });
      }
    },
  });

  // Remove user from tenant
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/tenants/:tenantId/users/:userId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: userParamsSchema,
      tags: ['User Management'],
      summary: 'Remove User from Tenant',
      description: 'Remove a user from a specific tenant',
    },
    handler: async (
      request: FastifyRequest<{ Params: { userId: string; tenantId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId, tenantId } = request.params;

        const { dbUser } = await checkPermission(request, tenantId, 'users:delete');

        // Prevent self-removal
        if (dbUser.id === userId) {
          reply.status(400).send({
            message: 'Cannot remove yourself from the tenant',
          });
          return;
        }

        await UserManagementService.removeUserFromTenant(userId, tenantId);

        reply.send({
          message: 'User removed from tenant successfully',
        });
      } catch (error: any) {
        fastify.log.error(`Error removing user from tenant: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 400).send({
          message: error.message.includes('permission') ? 'Access denied' : 'Failed to remove user',
          error: error.message,
        });
      }
    },
  });

  // Get all users in a tenant
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/tenants/:tenantId/users`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: tenantParamsSchema,
      tags: ['User Management'],
      summary: 'Get Tenant Users',
      description: 'Get all users in a specific tenant with their roles',
    },
    handler: async (
      request: FastifyRequest<{ Params: { tenantId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request.params;

        await checkPermission(request, tenantId, 'users:read');

        const tenantUsers = await UserManagementService.getTenantUsers(tenantId);

        reply.send({
          message: 'Users retrieved successfully',
          data: tenantUsers,
        });
      } catch (error: any) {
        fastify.log.error(`Error getting tenant users: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 500).send({
          message: error.message.includes('permission') ? 'Access denied' : 'Failed to get users',
          error: error.message,
        });
      }
    },
  });

  // Toggle user active status
  fastify.route({
    method: HttpMethods.PATCH,
    url: `${basePath}/users/:userId/status`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: Type.Object({ userId: Type.String() }),
      body: toggleUserStatusBodySchema,
      tags: ['User Management'],
      summary: 'Toggle User Status',
      description: 'Activate or deactivate a user',
    },
    handler: async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: { isActive: boolean };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const { isActive } = request.body;

        const supabaseUser = (request as any).user;
        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);

        if (!dbUser) {
          reply.status(404).send({ message: 'User not found in database' });
          return;
        }

        // Get user's tenants to check permission in at least one
        const userTenants = await TenantService.getUserTenants(dbUser.id);
        let hasPermission = false;

        for (const userTenant of userTenants) {
          const canDeactivate = await RoleService.userHasPermission(
            dbUser.id,
            userTenant.tenant.id,
            'users:deactivate'
          );
          if (canDeactivate) {
            hasPermission = true;
            break;
          }
        }

        if (!hasPermission) {
          reply.status(403).send({
            message: 'Access denied: users:deactivate permission required',
          });
          return;
        }

        // Prevent self-deactivation
        if (dbUser.id === userId) {
          reply.status(400).send({
            message: 'Cannot change your own status',
          });
          return;
        }

        const updatedUser = await UserManagementService.toggleUserStatus(userId, isActive);

        reply.send({
          message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            isActive: updatedUser.isActive,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error toggling user status: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to update user status',
          error: error.message,
        });
      }
    },
  });

  // Get available roles for a tenant
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/tenants/:tenantId/roles`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: tenantParamsSchema,
      tags: ['User Management'],
      summary: 'Get Tenant Roles',
      description: 'Get all available roles for a tenant',
    },
    handler: async (
      request: FastifyRequest<{ Params: { tenantId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request.params;

        await checkPermission(request, tenantId, 'roles:read');

        const roles = await RoleService.getTenantRoles(tenantId);

        reply.send({
          message: 'Roles retrieved successfully',
          roles,
        });
      } catch (error: any) {
        fastify.log.error(`Error getting tenant roles: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 500).send({
          message: error.message.includes('permission') ? 'Access denied' : 'Failed to get roles',
          error: error.message,
        });
      }
    },
  });

  // Get user permissions in tenant
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/tenants/:tenantId/users/:userId/permissions`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: userParamsSchema,
      tags: ['User Management'],
      summary: 'Get User Permissions',
      description: "Get a user's permissions in a specific tenant",
    },
    handler: async (
      request: FastifyRequest<{ Params: { userId: string; tenantId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId, tenantId } = request.params;

        await checkPermission(request, tenantId, 'users:read');

        const permissions = await RoleService.getUserPermissions(userId, tenantId);

        reply.send({
          message: 'User permissions retrieved successfully',
          permissions,
        });
      } catch (error: any) {
        fastify.log.error(`Error getting user permissions: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 500).send({
          message: error.message.includes('permission')
            ? 'Access denied'
            : 'Failed to get permissions',
          error: error.message,
        });
      }
    },
  });

  // Get current user's permissions
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/my-permissions/:tenantId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      params: tenantParamsSchema,
      tags: ['User Management'],
      summary: 'Get My Permissions',
      description: "Get current user's permissions in a specific tenant",
    },
    handler: async (
      request: FastifyRequest<{ Params: { tenantId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request.params;
        const supabaseUser = (request as any).user;

        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
        if (!dbUser) {
          reply.status(404).send({ message: 'User not found' });
          return;
        }

        const permissions = await RoleService.getUserPermissions(dbUser.id, tenantId);
        const userInTenant = await UserManagementService.getUserInTenant(dbUser.id, tenantId);

        reply.send({
          message: 'Permissions retrieved successfully',
          permissions,
          role: userInTenant?.role,
          canInvite: await UserManagementService.canUserInvite(dbUser.id, tenantId),
          canManage: await UserManagementService.canUserManage(dbUser.id, tenantId),
        });
      } catch (error: any) {
        fastify.log.error(`Error getting user permissions: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to get permissions',
          error: error.message,
        });
      }
    },
  });

  // Create read-only role
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/roles/read-only`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: createReadOnlyRoleBodySchema,
      tags: ['User Management'],
      summary: 'Create Read-Only Role',
      description: 'Create a new read-only role with specified resources',
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          name: string;
          description: string;
          tenantId?: string;
          resources?: string[];
          isSystemRole?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { name, description, tenantId, resources, isSystemRole = false } = request.body;

        // Check permissions based on role type
        if (isSystemRole) {
          // For system roles, check if user is super admin
          const supabaseUser = (request as any).user;
          const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
          if (!dbUser) {
            reply.status(404).send({ message: 'User not found' });
            return;
          }

          // For now, we'll require that the user has role creation permissions in at least one tenant
          // In a more sophisticated system, you might want a specific system admin permission
          const userTenants = await TenantService.getUserTenants(dbUser.id);
          let hasPermission = false;

          for (const userTenant of userTenants) {
            const canCreate = await RoleService.userHasPermission(
              dbUser.id,
              userTenant.tenant.id,
              'roles:create'
            );
            if (canCreate) {
              hasPermission = true;
              break;
            }
          }

          if (!hasPermission) {
            reply.status(403).send({
              message: 'Access denied: roles:create permission required',
            });
            return;
          }
        } else {
          // For tenant roles, check tenant-specific permissions
          if (!tenantId) {
            reply.status(400).send({
              message: 'tenantId is required for non-system roles',
            });
            return;
          }

          await checkPermission(request, tenantId, 'roles:create');
        }

        const newRole = await RoleService.createReadOnlyRole(
          name,
          description,
          tenantId,
          resources,
          isSystemRole
        );

        reply.status(201).send({
          message: 'Read-only role created successfully',
          role: newRole,
        });
      } catch (error: any) {
        fastify.log.error(`Error creating read-only role: ${error.message}`);
        reply.status(error.message.includes('permission') ? 403 : 400).send({
          message: error.message.includes('permission')
            ? 'Access denied'
            : 'Failed to create read-only role',
          error: error.message,
        });
      }
    },
  });

  // Get read permissions for specified resources
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/permissions/read`,
    preHandler: [fastify.authPrehandler],
    schema: {
      querystring: Type.Object({
        resources: Type.Optional(Type.String()),
      }),
      tags: ['User Management'],
      summary: 'Get Read Permissions',
      description: 'Get all available read permissions for specified resources',
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: { resources?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const resourcesParam = request.query.resources;
        const resources = resourcesParam ? resourcesParam.split(',') : undefined;

        const readPermissions = await RoleService.getReadPermissions(resources);

        reply.send({
          message: 'Read permissions retrieved successfully',
          permissions: readPermissions,
        });
      } catch (error: any) {
        fastify.log.error(`Error getting read permissions: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to get read permissions',
          error: error.message,
        });
      }
    },
  });
}
