import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { InviteService, InviteDto, CreateInviteData } from '@/modules/invite.service';
import { EmailService } from '@/modules/email.service';
import { SupabaseAdminService } from '@/modules/supabase-admin.service';
import { TenantService } from '@/modules/tenant.service';
import { UserService } from '@/modules/user.service';

const basePath = '';

// Schema for invite creation
const createInviteSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  firstName: Type.String({ minLength: 1, maxLength: 50 }),
  lastName: Type.Optional(Type.String({ maxLength: 50 })),
  role: Type.Union([Type.Literal('owner'), Type.Literal('manager'), Type.Literal('rep')]),
  dailyCap: Type.Optional(Type.Integer({ minimum: 1, maximum: 2000 })),
});

// Schema for invite verification
const verifyInviteSchema = Type.Object({
  token: Type.String(),
});

// Schema for users list query params
const usersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

export default async function InviteRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get users for a tenant (Admin only)
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/users`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      querystring: usersQuerySchema,
      tags: ['Invites'],
      summary: 'Get Users for Tenant',
      description: 'Get all users (seats + invites) for a tenant. Admin only.',
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
        const currentUser = (request as any).user;
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
          dailyCap: request.body.dailyCap || 200,
        };

        // Create Supabase user (disabled state)
        const _supabaseUser = await SupabaseAdminService.createUser({
          email: inviteData.email,
          emailConfirm: false,
          metadata: { workspaceId: tenantId },
        });

        // Create invitation in database
        const { invite, token } = await InviteService.createInvite(inviteData);

        // Generate password set link
        const redirectUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:3030'}/accept-invite?token=${token}`;
        const passwordSetLink = await SupabaseAdminService.generateLink({
          type: 'signup',
          email: inviteData.email,
          redirectTo: redirectUrl,
        });

        // Get tenant and user info for email
        const tenant = await TenantService.getTenantById(tenantId);
        const inviterUser = await UserService.getUserById(currentUser.id);

        // Send invitation email
        const emailResult = await EmailService.sendInviteEmail({
          email: inviteData.email,
          firstName: inviteData.firstName,
          inviteLink: passwordSetLink,
          workspaceName: tenant?.name || 'DripIQ',
          inviterName: inviterUser?.name || currentUser.email,
        });

        // Update invite with message ID if available
        if (emailResult.messageId) {
          // TODO: Update invite with messageId
        }

        reply.status(201).send({
          message: 'Invitation sent successfully',
          invite: {
            id: invite.id,
            email: invite.email,
            role: invite.role,
            status: invite.status,
            expiresAt: invite.expiresAt,
          },
        });
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

  // Verify invitation token
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/invites/verify`,
    schema: {
      body: verifyInviteSchema,
      tags: ['Invites'],
      summary: 'Verify Invitation Token',
      description: 'Verify an invitation token and return invitation details.',
    },
    handler: async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
      try {
        const { token } = request.body;

        const invite = await InviteService.verifyInviteToken(token);

        if (!invite) {
          reply.status(404).send({
            message: 'Invalid or expired invitation token',
          });
          return;
        }

        reply.send({
          message: 'Token is valid',
          invite: {
            id: invite.id,
            email: invite.email,
            firstName: invite.firstName,
            lastName: invite.lastName,
            role: invite.role,
            tenantId: invite.tenantId,
            expiresAt: invite.expiresAt,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error verifying invitation: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to verify invitation',
          error: error.message,
        });
      }
    },
  });

  // Accept invitation
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/invites/accept`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: verifyInviteSchema,
      tags: ['Invites'],
      summary: 'Accept Invitation',
      description: 'Accept an invitation and create user seat.',
    },
    handler: async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
      try {
        const { token } = request.body;
        const currentUser = (request as any).user;

        const result = await InviteService.acceptInvite(token, currentUser.supabaseId);

        // Update Supabase user to enable login
        await SupabaseAdminService.updateUser(currentUser.supabaseId, {
          email_confirm: true,
          user_metadata: {
            invited: true,
            tenantId: result.invite.tenantId,
          },
        });

        reply.send({
          message: 'Invitation accepted successfully',
          invite: result.invite,
          seat: result.seat,
        });
      } catch (error: any) {
        fastify.log.error(`Error accepting invitation: ${error.message}`);

        if (error.message.includes('Invalid or expired')) {
          reply.status(404).send({
            message: error.message,
          });
        } else if (error.message.includes('already a member')) {
          reply.status(409).send({
            message: error.message,
          });
        } else {
          reply.status(500).send({
            message: 'Failed to accept invitation',
            error: error.message,
          });
        }
      }
    },
  });

  // Resend invitation (Admin only)
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/invites/:inviteId/resend`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: Type.Object({ inviteId: Type.String() }),
      tags: ['Invites'],
      summary: 'Resend Invitation',
      description: 'Resend an invitation email. Admin only.',
    },
    handler: async (
      request: FastifyRequest<{ Params: { inviteId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { inviteId } = request.params;
        const currentUser = (request as any).user;

        const { invite, token } = await InviteService.resendInvite(inviteId);

        // Generate new password set link
        const redirectUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:3030'}/accept-invite?token=${token}`;
        const passwordSetLink = await SupabaseAdminService.generateLink({
          type: 'signup',
          email: invite.email,
          redirectTo: redirectUrl,
        });

        // Get tenant info for email
        const tenant = await TenantService.getTenantById(invite.tenantId);
        const inviterUser = await UserService.getUserById(currentUser.id);

        // Resend invitation email
        await EmailService.sendInviteEmail({
          email: invite.email,
          firstName: invite.firstName || 'User',
          inviteLink: passwordSetLink,
          workspaceName: tenant?.name || 'DripIQ',
          inviterName: inviterUser?.name || currentUser.email,
        });

        reply.send({
          message: 'Invitation resent successfully',
          invite: {
            id: invite.id,
            email: invite.email,
            expiresAt: invite.expiresAt,
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

  // Revoke invitation (Admin only)
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/invites/:inviteId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: Type.Object({ inviteId: Type.String() }),
      tags: ['Invites'],
      summary: 'Revoke Invitation',
      description: 'Revoke/cancel an invitation. Admin only.',
    },
    handler: async (
      request: FastifyRequest<{ Params: { inviteId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { inviteId } = request.params;

        const revokedInvite = await InviteService.revokeInvite(inviteId);

        reply.send({
          message: 'Invitation revoked successfully',
          invite: {
            id: revokedInvite.id,
            email: revokedInvite.email,
            status: revokedInvite.status,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error revoking invitation: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to revoke invitation',
          error: error.message,
        });
      }
    },
  });
}
