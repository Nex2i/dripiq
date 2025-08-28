import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { createId } from '@paralleldrive/cuid2';
import { HttpMethods } from '@/utils/HttpMethods';
import { UserService } from '@/modules/user.service';
import { emailSenderIdentityRepository, userTenantRepository } from '@/repositories';
import { DEFAULT_CALENDAR_TIE_IN } from '@/constants';
import { EmailExecutionService } from '@/workers/campaign-execution/email-execution.service';
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

        const userSenderIdentity = await emailSenderIdentityRepository.findByUserIdForTenant(
          userId,
          tenantId
        );

        // Create mock objects for the email execution service
        // This allows us to use the same email flow as real campaigns (calendar links, unsubscribe, etc.)
        const testCampaignId = createId();
        const testContactId = createId();
        const testNodeId = 'test-email-node';

        // Create mock contact object
        const mockContact = {
          id: testContactId,
          leadId: createId(),
          name: 'Test Contact',
          email: recipientEmail,
          phone: null,
          title: null,
          company: null,
          sourceUrl: null,
          manuallyReviewed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Create mock campaign object
        const mockCampaign = {
          id: testCampaignId,
          tenantId,
          leadId: mockContact.leadId,
          contactId: testContactId,
          channel: 'email' as const,
          status: 'active' as const,
          currentNodeId: testNodeId,
          planJson: {
            version: '1.0',
            timezone: 'America/Los_Angeles',
            defaults: {
              timers: {
                no_open_after: 'PT72H',
                no_click_after: 'PT24H',
              },
            },
            startNodeId: testNodeId,
            nodes: [
              {
                id: testNodeId,
                channel: 'email' as const,
                action: 'send' as const,
                subject: subject,
                body: body,
                schedule: { delay: 'PT0S' },
                transitions: [],
              },
            ],
          },
          planVersion: '1.0',
          planHash: 'test-hash',
          senderIdentityId: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Create mock node object
        const mockNode = {
          id: testNodeId,
          channel: 'email' as const,
          action: 'send' as const,
          subject: subject,
          body: body,
          schedule: { delay: 'PT0S' },
          transitions: [],
        };

        // Use the EmailExecutionService directly to get all campaign features
        const emailExecutionService = new EmailExecutionService(tenantId);
        const result = await emailExecutionService.executeEmailSend({
          tenantId,
          campaignId: testCampaignId,
          contactId: testContactId,
          nodeId: testNodeId,
          node: mockNode,
          contact: mockContact,
          campaign: mockCampaign,
          planJson: mockCampaign.planJson,
          senderIdentity: userSenderIdentity,
        });

        if (!result.success) {
          throw new Error(result.error || 'Email execution failed');
        }

        reply.send({
          success: true,
          message: 'Test email sent successfully via campaign execution flow',
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
