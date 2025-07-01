import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { RoleService, CreateRoleData, CreatePermissionData } from '@/modules/role.service';
import { UserService } from '@/modules/user.service';

const basePath = '/roles';

// Schema for create role endpoint
const createRoleBodySchema = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
});

// Schema for create permission endpoint
const createPermissionBodySchema = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
  resource: Type.String(),
  action: Type.String(),
});

// Schema for assign permission to role endpoint
const assignPermissionBodySchema = Type.Object({
  permissionId: Type.String(),
});

export default async function RolesRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get all roles
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Roles'],
      summary: 'Get All Roles',
      description: 'Get all available roles in the system',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const roles = await RoleService.getAllRoles();
        reply.send({
          message: 'Roles retrieved successfully',
          roles,
        });
      } catch (error: any) {
        fastify.log.error(`Error fetching roles: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch roles',
          error: error.message,
        });
      }
    },
  });

  // Get all permissions
  fastify.route({
    method: HttpMethods.GET,
    url: '/permissions',
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Roles'],
      summary: 'Get All Permissions',
      description: 'Get all available permissions in the system',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const permissions = await RoleService.getAllPermissions();
        reply.send({
          message: 'Permissions retrieved successfully',
          permissions,
        });
      } catch (error: any) {
        fastify.log.error(`Error fetching permissions: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch permissions',
          error: error.message,
        });
      }
    },
  });

  // Get role by ID with permissions
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/:roleId`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Roles'],
      summary: 'Get Role by ID',
      description: 'Get a specific role with its permissions',
      params: Type.Object({
        roleId: Type.String(),
      }),
    },
    handler: async (
      request: FastifyRequest<{ Params: { roleId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { roleId } = request.params;
        const role = await RoleService.getRoleById(roleId);

        if (!role) {
          reply.status(404).send({ message: 'Role not found' });
          return;
        }

        reply.send({
          message: 'Role retrieved successfully',
          role,
        });
      } catch (error: any) {
        fastify.log.error(`Error fetching role: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch role',
          error: error.message,
        });
      }
    },
  });

  // Create new role (Admin only)
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      body: createRoleBodySchema,
      tags: ['Roles'],
      summary: 'Create Role',
      description: 'Create a new role (Admin only)',
    },
    handler: async (request: FastifyRequest<{ Body: CreateRoleData }>, reply: FastifyReply) => {
      try {
        const roleData = request.body;
        const role = await RoleService.createRole(roleData);

        reply.status(201).send({
          message: 'Role created successfully',
          role,
        });
      } catch (error: any) {
        fastify.log.error(`Error creating role: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to create role',
          error: error.message,
        });
      }
    },
  });

  // Create new permission (Admin only)
  fastify.route({
    method: HttpMethods.POST,
    url: '/permissions',
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      body: createPermissionBodySchema,
      tags: ['Roles'],
      summary: 'Create Permission',
      description: 'Create a new permission (Admin only)',
    },
    handler: async (
      request: FastifyRequest<{ Body: CreatePermissionData }>,
      reply: FastifyReply
    ) => {
      try {
        const permissionData = request.body;
        const permission = await RoleService.createPermission(permissionData);

        reply.status(201).send({
          message: 'Permission created successfully',
          permission,
        });
      } catch (error: any) {
        fastify.log.error(`Error creating permission: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to create permission',
          error: error.message,
        });
      }
    },
  });

  // Assign permission to role (Admin only)
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/:roleId/permissions`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      body: assignPermissionBodySchema,
      tags: ['Roles'],
      summary: 'Assign Permission to Role',
      description: 'Assign a permission to a role (Admin only)',
      params: Type.Object({
        roleId: Type.String(),
      }),
    },
    handler: async (
      request: FastifyRequest<{
        Params: { roleId: string };
        Body: { permissionId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { roleId } = request.params;
        const { permissionId } = request.body;

        const rolePermission = await RoleService.assignPermissionToRole(roleId, permissionId);

        reply.status(201).send({
          message: 'Permission assigned to role successfully',
          rolePermission,
        });
      } catch (error: any) {
        fastify.log.error(`Error assigning permission to role: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to assign permission to role',
          error: error.message,
        });
      }
    },
  });

  // Remove permission from role (Admin only)
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/:roleId/permissions/:permissionId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Roles'],
      summary: 'Remove Permission from Role',
      description: 'Remove a permission from a role (Admin only)',
      params: Type.Object({
        roleId: Type.String(),
        permissionId: Type.String(),
      }),
    },
    handler: async (
      request: FastifyRequest<{
        Params: { roleId: string; permissionId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { roleId, permissionId } = request.params;

        await RoleService.removePermissionFromRole(roleId, permissionId);

        reply.send({
          message: 'Permission removed from role successfully',
        });
      } catch (error: any) {
        fastify.log.error(`Error removing permission from role: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to remove permission from role',
          error: error.message,
        });
      }
    },
  });

  // Get user permissions for a tenant
  fastify.route({
    method: HttpMethods.GET,
    url: '/user-permissions/:tenantId',
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Roles'],
      summary: 'Get User Permissions',
      description: 'Get current user permissions for a specific tenant',
      params: Type.Object({
        tenantId: Type.String(),
      }),
    },
    handler: async (
      request: FastifyRequest<{ Params: { tenantId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request.params;
        const supabaseUser = (request as any).user;

        if (!supabaseUser?.id) {
          reply.status(401).send({ message: 'Authentication required' });
          return;
        }

        // Get user from database using Supabase ID
        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);
        if (!dbUser) {
          reply.status(404).send({ message: 'User not found' });
          return;
        }

        const userPermissions = await RoleService.getUserPermissions(dbUser.id, tenantId);

        if (!userPermissions) {
          reply.status(404).send({ message: 'User not found in tenant or no role assigned' });
          return;
        }

        reply.send({
          message: 'User permissions retrieved successfully',
          userPermissions,
        });
      } catch (error: any) {
        fastify.log.error(`Error fetching user permissions: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch user permissions',
          error: error.message,
        });
      }
    },
  });

  // Update role (Admin only)
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:roleId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      body: createRoleBodySchema,
      tags: ['Roles'],
      summary: 'Update Role',
      description: 'Update a role (Admin only)',
      params: Type.Object({
        roleId: Type.String(),
      }),
    },
    handler: async (
      request: FastifyRequest<{
        Params: { roleId: string };
        Body: Partial<CreateRoleData>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { roleId } = request.params;
        const updateData = request.body;

        const role = await RoleService.updateRole(roleId, updateData);

        reply.send({
          message: 'Role updated successfully',
          role,
        });
      } catch (error: any) {
        fastify.log.error(`Error updating role: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to update role',
          error: error.message,
        });
      }
    },
  });

  // Delete role (Admin only)
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/:roleId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      tags: ['Roles'],
      summary: 'Delete Role',
      description: 'Delete a role (Admin only)',
      params: Type.Object({
        roleId: Type.String(),
      }),
    },
    handler: async (
      request: FastifyRequest<{ Params: { roleId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { roleId } = request.params;

        const role = await RoleService.deleteRole(roleId);

        reply.send({
          message: 'Role deleted successfully',
          role,
        });
      } catch (error: any) {
        fastify.log.error(`Error deleting role: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to delete role',
          error: error.message,
        });
      }
    },
  });
}
