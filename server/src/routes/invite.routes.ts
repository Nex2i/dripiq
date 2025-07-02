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
    // preHandler: [fastify.authPrehandler],
    schema: {
      body: verifyInviteSchema,
      tags: ['Invites'],
      summary: 'Accept Invitation',
      description: 'Accept an invitation and create user seat.',
    },
    handler: async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
      try {
        const { token } = request.body;

        const result = await InviteService.acceptInvite(token);

        // Check if this is a new user who needs to set their password
        // New users will have been created via inviteUserByEmail and need to set password
        let needsPasswordSetup = false;
        let passwordSetupUrl = null;

        if (result.invite.supabaseId) {
          // Update Supabase user to enable login
          await SupabaseAdminService.updateUser(result.invite.supabaseId, {
            email_confirm: true,
            user_metadata: {
              invited: true,
              tenantId: result.invite.tenantId,
            },
          });

          // Generate a password reset link for new users to set their password
          try {
            const resetLink = await SupabaseAdminService.generateLink({
              type: 'recovery',
              email: result.invite.email,
              redirectTo: `${process.env.FRONTEND_ORIGIN}/auth/setup-password?invited=true`,
            });
            needsPasswordSetup = true;
            passwordSetupUrl = resetLink;
          } catch (error: any) {
            fastify.log.warn(`Could not generate password setup link: ${error.message}`);
          }
        }

        reply.send({
          message: 'Invitation accepted successfully',
          invite: result.invite,
          seat: result.seat,
          needsPasswordSetup,
          passwordSetupUrl,
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

        // Use Supabase's invite functionality to resend
        const redirectUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:3030'}/accept-invite?token=${token}`;
        await SupabaseAdminService.inviteUserByEmail({
          email: invite.email,
          redirectTo: redirectUrl,
          data: {
            workspaceId: invite.tenantId,
            inviteToken: token,
            firstName: invite.firstName,
            lastName: invite.lastName,
            role: invite.role,
          },
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
      body: false, // Explicitly indicate no body is expected
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
