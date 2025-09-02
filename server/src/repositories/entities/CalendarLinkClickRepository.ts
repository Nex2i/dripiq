import { eq, and, gte, lte, desc, isNull, or } from 'drizzle-orm';
import { calendarLinkClicks, CalendarLinkClick, NewCalendarLinkClick } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface CreateCalendarLinkClickData {
  leadId: string;
  contactId: string;
  userId: string;
  campaignId?: string;
  nodeId?: string;
  outboundMessageId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}

export class CalendarLinkClickRepository extends TenantAwareRepository<
  typeof calendarLinkClicks,
  CalendarLinkClick,
  NewCalendarLinkClick
> {
  constructor() {
    super(calendarLinkClicks);
  }

  async createForTenant(
    tenantId: string,
    data: CreateCalendarLinkClickData
  ): Promise<CalendarLinkClick> {
    const [calendarLinkClick] = await this.db
      .insert(this.table)
      .values({
        tenantId,
        ...data,
      })
      .returning();

    return calendarLinkClick!;
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<CalendarLinkClick | undefined> {
    const [calendarLinkClick] = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);

    return calendarLinkClick;
  }

  /**
   * Find calendar clicks for a contact within a time window
   */
  async findByContactInTimeWindow(
    tenantId: string,
    contactId: string,
    leadId: string,
    windowStart: Date,
    windowEnd: Date,
    campaignId?: string,
    limit?: number
  ): Promise<CalendarLinkClick[]> {
    let whereConditions = and(
      eq(this.table.tenantId, tenantId),
      eq(this.table.contactId, contactId),
      eq(this.table.leadId, leadId),
      gte(this.table.clickedAt, windowStart),
      lte(this.table.clickedAt, windowEnd)
    );

    // Add campaign filter if provided
    // Note: campaignId is nullable in the schema
    if (campaignId) {
      // When campaignId is provided, we have two options:
      // 1. Only find clicks for this specific campaign: eq(this.table.campaignId, campaignId)
      // 2. Find clicks for this campaign OR clicks without campaign context: or(eq(...), isNull(...))
      // 
      // For calendar click validation (no_click timeouts), we want option 2
      // because ANY calendar click should indicate engagement, regardless of campaign tracking
      whereConditions = and(
        whereConditions,
        or(
          eq(this.table.campaignId, campaignId),
          isNull(this.table.campaignId)
        )
      );
    }
    // If campaignId is not provided, we include all clicks (no additional filtering needed)

    let query = this.db
      .select()
      .from(this.table)
      .where(whereConditions)
      .orderBy(desc(this.table.clickedAt)); // Most recent first

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  /**
   * Get the latest calendar click for a contact
   */
  async findLatestByContact(
    tenantId: string,
    contactId: string,
    leadId: string,
    campaignId?: string
  ): Promise<CalendarLinkClick | undefined> {
    const clicks = await this.findByContactInTimeWindow(
      tenantId,
      contactId,
      leadId,
      new Date(0), // From beginning of time
      new Date(), // To now
      campaignId,
      1 // Limit to 1 result
    );

    return clicks.length > 0 ? clicks[0] : undefined;
  }
}

export const calendarLinkClickRepository = new CalendarLinkClickRepository();
