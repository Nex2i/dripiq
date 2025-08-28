import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { createId } from '@paralleldrive/cuid2';
import { HttpMethods } from '@/utils/HttpMethods';
import { UserService } from '@/modules/user.service';
import { emailSenderIdentityRepository, userTenantRepository } from '@/repositories';
import { unsubscribeService } from '@/modules/unsubscribe';
import { DEFAULT_CALENDAR_TIE_IN } from '@/constants';
import { EmailProcessor, type CampaignEmailData } from '@/services/email';
import type { IUser } from '@/plugins/authentication.plugin';
import {
  UpdateProfileRequestSchema,
  UserIdParamsSchema,
  TestEmailRequestSchema,
  TestEmailResponseSchema,
} from './apiSchema/users';

const basePath = '';

export default async function UserRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Get a single user (Admin only, within current tenant)
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/users/:userId`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: UserIdParamsSchema,
      tags: ['Users'],
      summary: 'Get user by id',
      description: 'Get a user by id within the current tenant (admin only).',
    },
    handler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const tenantId = (request as any).tenantId as string;

        // Ensure target user is part of this tenant
        await userTenantRepository.findByUserIdForTenant(userId, tenantId);

        const user = await UserService.getUserById(userId);
        if (!user) {
          reply.status(404).send({ message: 'User not found' });
          return;
        }

        reply.send({
          id: user.id,
          email: user.email,
          name: user.name || '',
          calendarLink: user.calendarLink || '',
          calendarTieIn: user.calendarTieIn || DEFAULT_CALENDAR_TIE_IN,
        });
      } catch (error: any) {
        fastify.log.error(`Error getting user: ${error.message}`);
        reply.status(500).send({ message: 'Failed to get user', error: error.message });
      }
    },
  });

  // Update own profile (authenticated user)
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/me/profile`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: UpdateProfileRequestSchema,
      tags: ['Users'],
      summary: 'Update own profile',
      description: "Update the authenticated user's profile (name only).",
    },
    handler: async (
      request: FastifyRequest<{
        Body: { name: string; calendarLink?: string; calendarTieIn: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { name, calendarLink, calendarTieIn } = request.body;
        const supabaseId = (request as any).user?.supabaseId as string;
        const finalCalendarTieIn = calendarTieIn?.trim() || DEFAULT_CALENDAR_TIE_IN;

        const updated = await UserService.updateUser(supabaseId, {
          name,
          calendarLink,
          calendarTieIn: finalCalendarTieIn,
        });
        reply.send({
          message: 'Profile updated',
          user: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            calendarLink: updated.calendarLink,
            calendarTieIn: updated.calendarTieIn,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error updating profile: ${error.message}`);
        reply.status(500).send({ message: 'Failed to update profile', error: error.message });
      }
    },
  });

  // Update any user profile (Admin only, within current tenant)
  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/users/:userId/profile`,
    preHandler: [fastify.authPrehandler, fastify.requireAdmin()],
    schema: {
      params: UserIdParamsSchema,
      body: UpdateProfileRequestSchema,
      tags: ['Users'],
      summary: 'Update user profile',
      description: "Update a user's profile (name only) within current tenant (admin only).",
    },
    handler: async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: { name: string; calendarLink?: string; calendarTieIn: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;
        const { name, calendarLink, calendarTieIn } = request.body;
        const tenantId = (request as any).tenantId as string;
        const finalCalendarTieIn = calendarTieIn?.trim() || DEFAULT_CALENDAR_TIE_IN;

        // Ensure target user is part of this tenant
        await userTenantRepository.findByUserIdForTenant(userId, tenantId);

        // Get user to derive supabaseId
        const targetUser = await UserService.getUserById(userId);
        if (!targetUser) {
          reply.status(404).send({ message: 'User not found' });
          return;
        }

        const updated = await UserService.updateUser(targetUser.supabaseId, {
          name,
          calendarLink,
          calendarTieIn: finalCalendarTieIn,
        });
        reply.send({
          message: 'User updated',
          user: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            calendarLink: updated.calendarLink,
            calendarTieIn: updated.calendarTieIn,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error updating user profile: ${error.message}`);
        reply.status(500).send({ message: 'Failed to update user profile', error: error.message });
      }
    },
  });

  // Send test email
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/users/test-email`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: TestEmailRequestSchema,
      response: {
        200: TestEmailResponseSchema,
      },
      tags: ['Users'],
      summary: 'Send test email',
      description: 'Send a test email with custom subject and body content.',
    },
    handler: async (
      request: FastifyRequest<{ Body: typeof TestEmailRequestSchema.static }>,
      reply: FastifyReply
    ) => {
      try {
        const { recipientEmail, subject, body } = request.body;
        const userId = ((request as any).user as IUser).id as string;
        const tenantId = (request as any).tenantId as string;

        // Get user info to validate access
        const user = await UserService.getUserById(userId);
        if (!user) {
          reply.status(404).send({ success: false, message: 'User not found' });
          return;
        }

        // CHECK UNSUBSCRIBE STATUS FIRST (early exit)
        const isUnsubscribed = await unsubscribeService.isChannelUnsubscribed(
          tenantId,
          'email',
          recipientEmail.toLowerCase()
        );

        if (isUnsubscribed) {
          reply.send({
            success: false,
            message: 'Recipient has unsubscribed from emails',
          });
          return;
        }

        // Fetch sender identity
        const senderIdentity = await emailSenderIdentityRepository.findByUserIdForTenant(
          userId,
          tenantId
        );

        if (!senderIdentity) {
          reply.status(400).send({
            success: false,
            message: 'No verified sender identity found for this tenant',
          });
          return;
        }

        // Generate test IDs
        const testCampaignId = createId();
        const testContactId = createId();
        const testNodeId = 'test-email-node';
        const testLeadId = createId();

        // Fetch calendar information if available (same as campaigns)
        let calendarInfo: CampaignEmailData['calendarInfo'];
        try {
          if (user.calendarLink && user.calendarTieIn) {
            calendarInfo = {
              calendarLink: user.calendarLink,
              calendarTieIn: user.calendarTieIn,
              leadId: testLeadId,
            };
          }
        } catch (calendarError) {
          fastify.log.error('Failed to fetch calendar information for test email', {
            userId,
            tenantId,
            error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
          } as any);
          // Continue without calendar info
        }

        // Prepare data for EmailProcessor
        const emailData: CampaignEmailData = {
          tenantId,
          campaignId: testCampaignId,
          contactId: testContactId,
          nodeId: testNodeId,
          subject,
          body,
          recipientEmail,
          recipientName: 'Test Contact',
          senderIdentity: {
            id: senderIdentity!.id,
            fromEmail: senderIdentity.fromEmail,
            fromName: senderIdentity.fromName,
          },
          calendarInfo,
          categories: ['test-email'],
          skipMessageRecord: true,
          skipTimeoutScheduling: true,
        };

        // Send email using EmailProcessor
        const result = await EmailProcessor.sendCampaignEmail(emailData);

        if (!result.success) {
          throw new Error(result.error || 'Email sending failed');
        }

        reply.send({
          success: true,
          message: 'Test email sent successfully via EmailProcessor',
          messageId: result.providerMessageId,
        });
      } catch (error: any) {
        fastify.log.error(`Error sending test email: ${error.message}`);
        reply.status(500).send({
          success: false,
          message: 'Failed to send test email',
        });
      }
    },
  });
}
