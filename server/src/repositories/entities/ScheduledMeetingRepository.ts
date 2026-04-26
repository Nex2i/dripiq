import { and, eq, gte, lt } from 'drizzle-orm';
import { scheduledMeetings, ScheduledMeeting, NewScheduledMeeting } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class ScheduledMeetingRepository extends TenantAwareRepository<
  typeof scheduledMeetings,
  ScheduledMeeting,
  NewScheduledMeeting
> {
  constructor() {
    super(scheduledMeetings);
  }

  async findByUserInRange(
    tenantId: string,
    userId: string,
    start: Date,
    end: Date
  ): Promise<ScheduledMeeting[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.userId, userId),
          gte(this.table.startTime, start),
          lt(this.table.startTime, end)
        )
      )
      .orderBy(this.table.startTime);
  }

  async createConfirmed(
    tenantId: string,
    data: Omit<NewScheduledMeeting, 'tenantId' | 'status'>
  ): Promise<ScheduledMeeting> {
    const [result] = await this.db
      .insert(this.table)
      .values({
        ...data,
        tenantId,
        status: 'confirmed',
      })
      .returning();

    return result as ScheduledMeeting;
  }

  async cancel(
    tenantId: string,
    id: string,
    metadata?: Record<string, unknown>
  ): Promise<ScheduledMeeting | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({
        status: 'canceled',
        metadata: metadata ?? {},
        updatedAt: new Date(),
      })
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();

    return result;
  }
}
