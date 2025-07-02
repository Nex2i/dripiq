import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { InviteService, InviteDto, CreateInviteData } from '@/modules/invite.service';
import { SupabaseAdminService } from '@/modules/supabase-admin.service';
import { handleExistingSupabaseUser, createNewUserInvite } from '@/modules/invite.handlers';

const basePath = '';

// Schema for invite creation
const createInviteSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  firstName: Type.String({ minLength: 1, maxLength: 50 }),
  lastName: Type.Optional(Type.String({ maxLength: 50 })),
  role: Type.String({ minLength: 1 }), // Accept any valid role name from database
});

// Schema for users list query params
const usersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

// Schema for updating user role
const updateUserRoleSchema = Type.Object({
  roleId: Type.String({ minLength: 1 }),
});

export default async function InviteRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get users for a tenant (Authenticated users only)
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/users`,
    preHandler: [fastify.authPrehandler],
    schema: {
      querystring: usersQuerySchema,
      tags: ['Invites'],
      summary: 'Get Users for Tenant',
      description: 'Get all users (seats + invites) for a tenant. Requires authentication.',
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          page?: number;
          limit?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { page = 1, limit = 25 } = request.query;
        const tenantId = (request as any).tenantId;

        const result = await InviteService.getTenantUsers(tenantId, page, limit);

        reply.send({
          success: true,
          data: result.users,
          pagination: {
            page: result.page,
            limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error fetching users: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch users',
          error: error.message,
        });
      }
    },
  });

  // Create invitation (Admin only)
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/invites`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      body: createInviteSchema,
      tags: ['Invites'],
      summary: 'Create User Invitation',
      description: 'Create a new user invitation. Admin only.',
    },
    handler: async (request: FastifyRequest<{ Body: InviteDto }>, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;

        if (!tenantId) {
          reply.status(400).send({ message: 'Tenant ID is required' });
          return;
        }

        const inviteData: CreateInviteData = {
          tenantId,
          email: request.body.email,
          firstName: request.body.firstName,
          lastName: request.body.lastName,
          role: request.body.role,
        };

        // Check if user already exists in Supabase
        const existingSupabaseUser = await SupabaseAdminService.getUserByEmail(inviteData.email);

        let result;
        if (existingSupabaseUser) {
          // Handle existing Supabase user
          result = await handleExistingSupabaseUser(existingSupabaseUser, inviteData, tenantId);
        } else {
          // Create new user invite
          result = await createNewUserInvite(inviteData, tenantId);
        }

        reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(`Error creating invitation: ${error.message}`);

        if (
          error.message.includes('already exists') ||
          error.message.includes('already a member')
        ) {
          reply.status(409).send({
            message: error.message,
          });
        } else if (error.message.includes('Invalid email') || error.message.includes('required')) {
          reply.status(422).send({
            message: 'Validation error',
            error: error.message,
          });
        } else {
          reply.status(500).send({
            message: 'Failed to create invitation',
            error: error.message,
          });
        }
      }
    },
  });

  // Activate user when they set their password (Public endpoint)
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/invites/activate`,
    schema: {
      body: Type.Object({
        supabaseId: Type.String(),
      }),
      tags: ['Invites'],
      summary: 'Activate User Account',
      description: 'Activate a user account when they complete password setup.',
    },
    handler: async (
      request: FastifyRequest<{ Body: { supabaseId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { supabaseId } = request.body;

        const userTenant = await InviteService.activateUserBySupabaseId(supabaseId);

        if (!userTenant) {
          reply.status(404).send({
            message: 'User not found or already activated',
          });
          return;
        }

        reply.send({
          message: 'User account activated successfully',
          userTenant: {
            id: userTenant.id,
            tenantId: userTenant.tenantId,
            roleId: userTenant.roleId,
            status: userTenant.status,
            acceptedAt: userTenant.acceptedAt,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error activating user: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to activate user account',
          error: error.message,
        });
      }
    },
  });

  // Resend invitation (Admin only)
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/users/:userId/resend`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: Type.Object({ userId: Type.String() }),
      tags: ['Invites'],
      summary: 'Resend Invitation',
      description: 'Resend an invitation email for a pending user. Admin only.',
    },
    handler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const tenantId = (request as any).tenantId;

        const { userTenant } = await InviteService.resendInvite(userId, tenantId);

        // Use Supabase's invite functionality to resend
        const redirectUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:3030'}/setup-password`;

        // Note: We'll need to get user email from the user record
        const { UserService } = await import('@/modules/user.service');
        const user = await UserService.getUserById(userId);

        if (!user) {
          reply.status(404).send({ message: 'User not found' });
          return;
        }

        await SupabaseAdminService.inviteUserByEmail({
          email: user.email,
          redirectTo: redirectUrl,
          data: {
            tenantId: tenantId,
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            role: userTenant.roleId,
          },
        });

        reply.send({
          message: 'Invitation resent successfully',
          userTenant: {
            id: userTenant.id,
            userId: userId,
            tenantId: tenantId,
            status: userTenant.status,
            invitedAt: userTenant.invitedAt,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error resending invitation: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to resend invitation',
          error: error.message,
        });
      }
    },
  });

  // Remove user from tenant (Admin only)
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/users/:userId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: Type.Object({ userId: Type.String() }),
      body: false, // Explicitly indicate no body is expected
      tags: ['Invites'],
      summary: 'Remove User',
      description: 'Remove a user from the tenant. Admin only.',
    },
    handler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const tenantId = (request as any).tenantId;

        await InviteService.removeUser(userId, tenantId);

        reply.send({
          message: 'User removed from workspace successfully',
        });
      } catch (error: any) {
        fastify.log.error(`Error removing user: ${error.message}`);

        if (error.message.includes('not found')) {
          reply.status(404).send({
            message: error.message,
          });
        } else {
          reply.status(500).send({
            message: 'Failed to remove user',
            error: error.message,
          });
        }
      }
    },
  });

  // Update user role (Admin only)
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/users/:userId/role`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: Type.Object({ userId: Type.String() }),
      body: updateUserRoleSchema,
      tags: ['Invites'],
      summary: 'Update User Role',
      description: "Update a user's role in the tenant. Admin only.",
    },
    handler: async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: { roleId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const { roleId } = request.body;
        const tenantId = (request as any).tenantId;

        const updatedUserTenant = await InviteService.updateUserRole(userId, tenantId, roleId);

        reply.send({
          message: 'User role updated successfully',
          userTenant: {
            id: updatedUserTenant.id,
            userId: userId,
            tenantId: tenantId,
            roleId: updatedUserTenant.roleId,
            status: updatedUserTenant.status,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error updating user role: ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('Invalid role')) {
          reply.status(404).send({
            message: error.message,
          });
        } else {
          reply.status(500).send({
            message: 'Failed to update user role',
            error: error.message,
          });
        }
      }
    },
  });
}
