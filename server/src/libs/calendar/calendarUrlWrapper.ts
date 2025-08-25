import { logger } from '@/libs/logger';

export interface CalendarLinkContext {
  tenantId: string;
  leadId: string;
  contactId: string;
  campaignId?: string;
  nodeId?: string;
  outboundMessageId?: string;
}

export class CalendarUrlWrapper {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generate a tracked calendar URL that will log clicks and redirect to the real calendar
   */
  generateTrackedCalendarUrl(context: CalendarLinkContext): string {
    const { tenantId, leadId, contactId, campaignId, nodeId, outboundMessageId } = context;

    // Build the tracking URL
    let trackingUrl = `${this.baseUrl}/api/calendar/track/${tenantId}/${leadId}/${contactId}`;

    // Add query parameters for additional context
    const queryParams = new URLSearchParams();
    if (campaignId) queryParams.append('campaignId', campaignId);
    if (nodeId) queryParams.append('nodeId', nodeId);
    if (outboundMessageId) queryParams.append('messageId', outboundMessageId);

    if (queryParams.toString()) {
      trackingUrl += `?${queryParams.toString()}`;
    }

    logger.debug('[CalendarUrlWrapper] Generated tracked calendar URL', {
      context,
      trackingUrl,
    });

    return trackingUrl;
  }

  /**
   * Create a calendar introduction message with the tracked link
   */
  createCalendarMessage(calendarTieIn: string, trackedUrl: string): string {
    return `${calendarTieIn}: ${trackedUrl}`;
  }
}

// Default instance using environment variable or localhost fallback
const defaultBaseUrl = process.env.API_URL;
if (!defaultBaseUrl) {
  throw new Error('API_URL is not set');
}

export const calendarUrlWrapper = new CalendarUrlWrapper(defaultBaseUrl);
