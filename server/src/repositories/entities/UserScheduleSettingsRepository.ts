import { and, eq } from 'drizzle-orm';
import { userScheduleSettings, UserScheduleSetting, NewUserScheduleSetting } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class UserScheduleSettingsRepository extends TenantAwareRepository<
  typeof userScheduleSettings,
  UserScheduleSetting,
  NewUserScheduleSetting
> {
  constructor() {
    super(userScheduleSettings);
  }

  async findByUserForTenant(
    tenantId: string,
    userId: string
  ): Promise<UserScheduleSetting | undefined> {
    const [result] = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.userId, userId)))
      .limit(1);

    return result;
  }

  async upsertForUser(
    tenantId: string,
    userId: string,
    data: Omit<NewUserScheduleSetting, 'tenantId' | 'userId'>
  ): Promise<UserScheduleSetting> {
    const [result] = await this.db
      .insert(this.table)
      .values({
        ...data,
        tenantId,
        userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [this.table.tenantId, this.table.userId],
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result as UserScheduleSetting;
  }
}
