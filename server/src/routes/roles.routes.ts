import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { RoleService, CreateRoleData, CreatePermissionData } from '@/modules/role.service';
import {
  RoleCreateSchema,
  RoleGetAllSchema,
  RoleGetByIdSchema,
  RoleUpdateSchema,
  RoleDeleteSchema,
  PermissionCreateSchema,
  PermissionGetAllSchema,
  PermissionAssignSchema,
  PermissionRemoveSchema,
} from '@/routes/apiSchema/role';

const basePath = '/roles';

export default async function RolesRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get all roles
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}`,
    preHandler: [fastify.authPrehandler],
    schema: {
      ...RoleGetAllSchema,
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
      ...PermissionGetAllSchema,
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
      ...RoleGetByIdSchema,
      tags: ['Roles'],
      summary: 'Get Role by ID',
      description: 'Get a specific role with its permissions',
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
      ...RoleCreateSchema,
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
      ...PermissionCreateSchema,
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
      ...PermissionAssignSchema,
      tags: ['Roles'],
      summary: 'Assign Permission to Role',
      description: 'Assign a permission to a role (Admin only)',
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
      ...PermissionRemoveSchema,
      tags: ['Roles'],
      summary: 'Remove Permission from Role',
      description: 'Remove a permission from a role (Admin only)',
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

  // Update role (Admin only)
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/:roleId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      ...RoleUpdateSchema,
      tags: ['Roles'],
      summary: 'Update Role',
      description: 'Update a role (Admin only)',
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
      ...RoleDeleteSchema,
      tags: ['Roles'],
      summary: 'Delete Role',
      description: 'Delete a role (Admin only)',
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
