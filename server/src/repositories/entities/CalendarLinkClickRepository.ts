import { eq, and } from 'drizzle-orm';
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
}

export const calendarLinkClickRepository = new CalendarLinkClickRepository();
