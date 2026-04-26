import { createId } from '@paralleldrive/cuid2';
import { calendarConnectionService } from './calendar/CalendarConnectionService';
import { calendarProviderFactory } from './calendar/CalendarProviderFactory';
import { availabilityService } from './AvailabilityService';
import { bookingTokenService } from './BookingTokenService';
import { lockService } from './LockService';
import { schedulingSettingsService } from './SchedulingSettingsService';
import {
  contactCampaignRepository,
  scheduleBookingTokenRepository,
  scheduledActionRepository,
  scheduledMeetingRepository,
} from '@/repositories';
import { ConflictError, ServiceUnavailableError } from '@/exceptions/error';
import { ScheduledMeeting } from '@/db/schema';
import { logger } from '@/libs/logger';
import { emailOrchestrator } from '@/libs/email/email.orchestrator';

export interface ConfirmBookingInput {
  token: string;
  holdId: string;
  slot: string;
  contactDetails: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface ConfirmBookingResult {
  meeting: ScheduledMeeting;
  calendarEventLink?: string;
}

export class SchedulingService {
  async confirmBooking(input: ConfirmBookingInput): Promise<ConfirmBookingResult> {
    const context = await bookingTokenService.resolve(input.token);
    const slotStart = new Date(input.slot);
    const settings = await schedulingSettingsService.getForUser(
      context.token.tenantId,
      context.token.userId
    );
    const slotEnd = availabilityService.addMinutes(slotStart, settings.meetingDurationMinutes);

    await lockService.validate(input.holdId, context.token.userId, input.slot);

    try {
      const localDate = this.formatDateInTimezone(slotStart, settings.timezone);
      const availability = await availabilityService.getAvailability({
        tenantId: context.token.tenantId,
        userId: context.token.userId,
        startDate: localDate,
        endDate: localDate,
      });

      if (!availabilityService.isSlotAvailable(slotStart, availability.availableSlots)) {
        throw new ConflictError('Selected slot is no longer available');
      }

      const connection = await calendarConnectionService.getActiveConnection(
        context.token.tenantId,
        context.token.userId
      );
      if (!connection) {
        throw new ServiceUnavailableError('No scheduling calendar connected');
      }

      const provider = calendarProviderFactory.create(connection);
      const event = await provider.createEvent({
        calendarId: connection.providerCalendarId,
        start: slotStart,
        end: slotEnd,
        timezone: settings.timezone,
        title: `Sales Demo - ${context.contact.company || context.lead.name || context.contact.name}`,
        description: `Booked from DripIQ Smart Scheduling for ${context.contact.name}.`,
        attendees: [
          {
            email: input.contactDetails.email,
            name: input.contactDetails.name,
          },
        ],
      });

      const meeting = await scheduledMeetingRepository.createConfirmed(context.token.tenantId, {
        userId: context.token.userId,
        leadId: context.token.leadId,
        contactId: context.token.contactId,
        bookingTokenId: context.token.id,
        campaignId: context.token.campaignId,
        calendarConnectionId: connection.id,
        startTime: slotStart,
        endTime: slotEnd,
        calendarEventId: event.id || createId(),
        provider: connection.provider,
        contactDetails: input.contactDetails,
        metadata: {
          calendarEventLink: event.htmlLink,
          nodeId: context.token.nodeId,
          outboundMessageId: context.token.outboundMessageId,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await scheduleBookingTokenRepository.markUsed(context.token.id, context.token.tenantId);
      await this.sendConfirmationEmail({
        tenantId: context.token.tenantId,
        userId: context.token.userId,
        campaignId: context.token.campaignId ?? meeting.id,
        contactName: input.contactDetails.name,
        contactEmail: input.contactDetails.email,
        start: slotStart,
        end: slotEnd,
        timezone: settings.timezone,
        calendarEventLink: event.htmlLink,
      });
      await this.stopActiveSequence(context.token.tenantId, context.token.contactId);

      return {
        meeting,
        calendarEventLink: event.htmlLink,
      };
    } catch (error) {
      await lockService.release(context.token.userId, input.slot, input.holdId);
      logger.warn('[SchedulingService] Booking confirmation failed', {
        tenantId: context.token.tenantId,
        userId: context.token.userId,
        tokenId: context.token.id,
        slot: input.slot,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private formatDateInTimezone(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  private async sendConfirmationEmail(input: {
    tenantId: string;
    userId: string;
    campaignId: string;
    contactName: string;
    contactEmail: string;
    start: Date;
    end: Date;
    timezone: string;
    calendarEventLink?: string;
  }): Promise<void> {
    try {
      const when = new Intl.DateTimeFormat('en-US', {
        timeZone: input.timezone,
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(input.start);
      const outboundMessageId = createId();
      const link = input.calendarEventLink
        ? `<p><a href="${input.calendarEventLink}">Open calendar event</a></p>`
        : '';

      await emailOrchestrator.sendEmail(input.userId, {
        tenantId: input.tenantId,
        campaignId: input.campaignId,
        nodeId: 'smart-scheduling-confirmation',
        outboundMessageId,
        dedupeKey: `${input.tenantId}:${input.contactEmail}:${input.start.toISOString()}:smart-scheduling-confirmation`,
        to: input.contactEmail,
        subject: 'Your sales demo is booked',
        html: `<p>Hi ${input.contactName},</p><p>Your sales demo is booked for ${when}.</p>${link}`,
        text: `Hi ${input.contactName},\n\nYour sales demo is booked for ${when}.\n${input.calendarEventLink ?? ''}`,
        categories: ['smart-scheduling', `tenant:${input.tenantId}`],
      });
    } catch (error) {
      logger.error('[SchedulingService] Failed to send booking confirmation email', {
        tenantId: input.tenantId,
        userId: input.userId,
        contactEmail: input.contactEmail,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async stopActiveSequence(tenantId: string, contactId: string): Promise<void> {
    try {
      const campaign = await contactCampaignRepository.findByContactAndChannelForTenant(
        tenantId,
        contactId,
        'email'
      );
      if (!campaign || !['active', 'paused', 'draft'].includes(campaign.status)) {
        return;
      }

      await contactCampaignRepository.updateByIdForTenant(campaign.id, tenantId, {
        status: 'stopped',
        completedAt: new Date(),
        updatedAt: new Date(),
      });
      await scheduledActionRepository.cancelByCampaignForTenant(tenantId, campaign.id);
    } catch (error) {
      logger.error('[SchedulingService] Failed to stop active sequence after booking', {
        tenantId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const schedulingService = new SchedulingService();
