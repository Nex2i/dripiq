import { logger } from '@/libs/logger';
import { calendarLinkClickRepository } from '@/repositories';
import type { CalendarLinkClick } from '@/db/schema';

export interface CalendarClickWindow {
  tenantId: string;
  campaignId?: string;
  contactId: string;
  leadId: string;
  timeWindowMs: number; // Time window in milliseconds to check for clicks
  referenceTime?: Date; // Reference time to check from (defaults to now)
}

export interface CalendarClickValidationResult {
  hasClicks: boolean;
  clickCount: number;
  latestClick?: CalendarLinkClick;
  timeWindow: {
    start: Date;
    end: Date;
  };
}

/**
 * Calendar Click Validation Service
 *
 * Handles validation of calendar link clicks for campaign flow control.
 * Used to determine if no_click timeouts should be canceled based on
 * actual calendar link clicks from the calendar_link_clicks table.
 */
export class CalendarClickValidationService {
  /**
   * Check if there are calendar clicks within a specified time window
   */
  async hasCalendarClicksInWindow(
    params: CalendarClickWindow
  ): Promise<CalendarClickValidationResult> {
    const {
      tenantId,
      campaignId,
      contactId,
      leadId,
      timeWindowMs,
      referenceTime = new Date(),
    } = params;

    try {
      const windowStart = new Date(referenceTime.getTime() - timeWindowMs);
      const windowEnd = referenceTime;

      logger.debug('Checking for calendar clicks in time window', {
        tenantId,
        campaignId,
        contactId,
        leadId,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        timeWindowMs,
      });

      // Query calendar clicks within the time window
      const clicks = await this.getCalendarClicksInWindow(
        tenantId,
        contactId,
        leadId,
        windowStart,
        windowEnd,
        campaignId
      );

      const result: CalendarClickValidationResult = {
        hasClicks: clicks.length > 0,
        clickCount: clicks.length,
        latestClick: clicks.length > 0 ? clicks[0] : undefined, // Assuming sorted by clickedAt desc
        timeWindow: {
          start: windowStart,
          end: windowEnd,
        },
      };

      logger.debug('Calendar click validation result', {
        tenantId,
        campaignId,
        contactId,
        leadId,
        hasClicks: result.hasClicks,
        clickCount: result.clickCount,
        latestClickId: result.latestClick?.id,
      });

      return result;
    } catch (error) {
      logger.error('Error validating calendar clicks', {
        tenantId,
        campaignId,
        contactId,
        leadId,
        timeWindowMs,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Return safe default (no clicks) on error to prevent system lockup
      return {
        hasClicks: false,
        clickCount: 0,
        timeWindow: {
          start: new Date(referenceTime.getTime() - timeWindowMs),
          end: referenceTime,
        },
      };
    }
  }

  /**
   * Private method to query calendar clicks within a time window
   */
  private async getCalendarClicksInWindow(
    tenantId: string,
    contactId: string,
    leadId: string,
    windowStart: Date,
    windowEnd: Date,
    campaignId?: string,
    limit?: number
  ): Promise<CalendarLinkClick[]> {
    try {
      logger.debug('Querying calendar clicks with filters', {
        tenantId,
        contactId,
        leadId,
        campaignId,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        limit,
      });

      const clicks = await calendarLinkClickRepository.findByContactInTimeWindow(
        tenantId,
        contactId,
        leadId,
        windowStart,
        windowEnd,
        campaignId,
        limit
      );

      logger.debug('Calendar clicks query result', {
        tenantId,
        contactId,
        leadId,
        clickCount: clicks.length,
        clickIds: clicks.map((c) => c.id),
      });

      return clicks;
    } catch (error) {
      logger.error('Error querying calendar clicks', {
        tenantId,
        contactId,
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const calendarClickValidationService = new CalendarClickValidationService();
