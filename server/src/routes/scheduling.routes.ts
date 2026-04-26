import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { logger } from '@/libs/logger';
import { schedulingSettingsService } from '@/modules/scheduling/SchedulingSettingsService';
import { bookingTokenService } from '@/modules/scheduling/BookingTokenService';
import { availabilityService } from '@/modules/scheduling/AvailabilityService';
import { lockService } from '@/modules/scheduling/LockService';
import { schedulingService } from '@/modules/scheduling/SchedulingService';
import {
  AvailabilityQuerySchema,
  AvailabilityResponseSchema,
  BookingTokenParamsSchema,
  PublicBookingContextResponseSchema,
  ScheduleConfirmRequestSchema,
  ScheduleConfirmResponseSchema,
  ScheduleHoldRequestSchema,
  ScheduleHoldResponseSchema,
  SchedulingSettingsRequestSchema,
  SchedulingSettingsResponseSchema,
} from './apiSchema/scheduling';

const basePath = '/schedule';

export default async function SchedulingRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/settings`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Scheduling'],
      summary: 'Get current user scheduling settings',
      response: {
        200: SchedulingSettingsResponseSchema,
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const settings = await schedulingSettingsService.getForUser(tenantId, user.id);
      return reply.send(settings);
    },
  });

  fastify.route({
    method: HttpMethods.PUT,
    url: `${basePath}/settings`,
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Scheduling'],
      summary: 'Update current user scheduling settings',
      body: SchedulingSettingsRequestSchema,
      response: {
        200: SchedulingSettingsResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: Parameters<typeof schedulingSettingsService.upsertForUser>[2];
      }>,
      reply: FastifyReply
    ) => {
      const { tenantId, user } = request as AuthenticatedRequest;
      const settings = await schedulingSettingsService.upsertForUser(tenantId, user.id, request.body);
      return reply.send(settings);
    },
  });

  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/public/:token`,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
    schema: {
      tags: ['Scheduling'],
      summary: 'Resolve public booking token context',
      params: BookingTokenParamsSchema,
      response: {
        200: PublicBookingContextResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { token: string } }>,
      reply: FastifyReply
    ) => {
      const context = await bookingTokenService.resolve(request.params.token);
      logger.info('[SchedulingRoutes] Public booking token resolved', {
        tenantId: context.token.tenantId,
        userId: context.token.userId,
        tokenId: context.token.id,
      });
      const settings = await schedulingSettingsService.getForUser(
        context.token.tenantId,
        context.token.userId
      );

      return reply.send({
        tokenId: context.token.id,
        timezone: settings.timezone,
        meetingDurationMinutes: settings.meetingDurationMinutes,
        lead: context.lead,
        contact: {
          id: context.contact.id,
          name: context.contact.name,
          email: context.contact.email ?? undefined,
          phone: context.contact.phone ?? undefined,
          company: context.contact.company ?? undefined,
        },
      });
    },
  });

  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/availability`,
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
    schema: {
      tags: ['Scheduling'],
      summary: 'Get public booking availability',
      querystring: AvailabilityQuerySchema,
      response: {
        200: AvailabilityResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: { token: string; startDate: string; endDate: string };
      }>,
      reply: FastifyReply
    ) => {
      const { token, startDate, endDate } = request.query;
      const availability = await availabilityService.getAvailabilityForToken(
        token,
        startDate,
        endDate
      );
      logger.info('[SchedulingRoutes] Availability loaded', {
        startDate,
        endDate,
        slotCount: availability.availableSlots.length,
      });
      return reply.send(availability);
    },
  });

  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/hold`,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
    schema: {
      tags: ['Scheduling'],
      summary: 'Temporarily hold a public booking slot',
      body: ScheduleHoldRequestSchema,
      response: {
        200: ScheduleHoldResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: { token: string; slot: string } }>,
      reply: FastifyReply
    ) => {
      const context = await bookingTokenService.resolve(request.body.token);
      const hold = await lockService.hold({
        tenantId: context.token.tenantId,
        userId: context.token.userId,
        tokenId: context.token.id,
        slot: request.body.slot,
      });
      logger.info('[SchedulingRoutes] Slot hold created', {
        tenantId: context.token.tenantId,
        userId: context.token.userId,
        tokenId: context.token.id,
      });

      return reply.send({
        holdId: hold.holdId,
        expiresAt: hold.expiresAt.toISOString(),
      });
    },
  });

  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/confirm`,
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
    schema: {
      tags: ['Scheduling'],
      summary: 'Confirm a public booking',
      body: ScheduleConfirmRequestSchema,
      response: {
        200: ScheduleConfirmResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          token: string;
          holdId: string;
          slot: string;
          contactDetails: { name: string; email: string; phone?: string };
        };
      }>,
      reply: FastifyReply
    ) => {
      const result = await schedulingService.confirmBooking(request.body);
      logger.info('[SchedulingRoutes] Booking confirmed', {
        meetingId: result.meeting.id,
        tenantId: result.meeting.tenantId,
        userId: result.meeting.userId,
      });

      return reply.send({
        meetingId: result.meeting.id,
        calendarEventLink: result.calendarEventLink,
      });
    },
  });
}
