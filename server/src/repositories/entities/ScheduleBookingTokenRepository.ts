import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { scheduleBookingTokens, ScheduleBookingToken, NewScheduleBookingToken } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class ScheduleBookingTokenRepository extends TenantAwareRepository<
  typeof scheduleBookingTokens,
  ScheduleBookingToken,
  NewScheduleBookingToken
> {
  constructor() {
    super(scheduleBookingTokens);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<ScheduleBookingToken | undefined> {
    const [result] = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tokenHash, tokenHash),
          isNull(this.table.revokedAt),
          isNull(this.table.usedAt),
          gt(this.table.expiresAt, new Date())
        )
      )
      .limit(1);

    return result;
  }

  async markUsed(id: string, tenantId: string): Promise<ScheduleBookingToken | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();

    return result;
  }

  async revoke(id: string, tenantId: string): Promise<ScheduleBookingToken | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();

    return result;
  }

  async deleteExpired(before = new Date()): Promise<ScheduleBookingToken[]> {
    return await this.db.delete(this.table).where(lt(this.table.expiresAt, before)).returning();
  }
}
