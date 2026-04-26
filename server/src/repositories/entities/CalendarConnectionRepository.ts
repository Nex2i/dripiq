import { and, eq } from 'drizzle-orm';
import { calendarConnections, CalendarConnection, NewCalendarConnection } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class CalendarConnectionRepository extends TenantAwareRepository<
  typeof calendarConnections,
  CalendarConnection,
  NewCalendarConnection
> {
  constructor() {
    super(calendarConnections);
  }

  async findActiveForUser(
    tenantId: string,
    userId: string
  ): Promise<CalendarConnection | undefined> {
    const [result] = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.userId, userId),
          eq(this.table.isActive, true)
        )
      )
      .limit(1);

    return result;
  }

  async upsertActiveForUser(
    tenantId: string,
    userId: string,
    data: Omit<NewCalendarConnection, 'tenantId' | 'userId'>
  ): Promise<CalendarConnection> {
    await this.db
      .update(this.table)
      .set({ isActive: false, disconnectedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.userId, userId),
          eq(this.table.isActive, true)
        )
      );

    const [result] = await this.db
      .insert(this.table)
      .values({
        ...data,
        tenantId,
        userId,
        isActive: true,
        updatedAt: new Date(),
      })
      .returning();

    return result as CalendarConnection;
  }

  async markReauthRequired(
    tenantId: string,
    id: string,
    reauthRequired = true
  ): Promise<CalendarConnection | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ reauthRequired, updatedAt: new Date() })
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();

    return result;
  }

  async disconnectByMailAccountId(mailAccountId: string): Promise<CalendarConnection[]> {
    return await this.db
      .update(this.table)
      .set({
        isActive: false,
        disconnectedAt: new Date(),
        reauthRequired: true,
        updatedAt: new Date(),
      })
      .where(eq(this.table.mailAccountId, mailAccountId))
      .returning();
  }
}
