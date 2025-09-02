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
    limit = limit ?? 10;

    let whereConditions = and(
      eq(this.table.tenantId, tenantId),
      eq(this.table.contactId, contactId),
      eq(this.table.leadId, leadId),
      gte(this.table.clickedAt, windowStart),
      lte(this.table.clickedAt, windowEnd)
    );

    // Include clicks for the specific campaign OR clicks without campaign context
    if (campaignId) {
      whereConditions = and(
        whereConditions,
        or(eq(this.table.campaignId, campaignId), isNull(this.table.campaignId))
      );
    }

    let query = this.db
      .select()
      .from(this.table)
      .where(whereConditions)
      .orderBy(desc(this.table.clickedAt))
      .limit(limit); // Most recent first

    return await query;
  }
}

export const calendarLinkClickRepository = new CalendarLinkClickRepository();
