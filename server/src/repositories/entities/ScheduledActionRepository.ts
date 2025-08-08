import { and, eq, lte } from 'drizzle-orm';
import {
  scheduledActions,
  ScheduledAction,
  NewScheduledAction,
  scheduledActionStatusEnum,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>ScheduledActionRepository manages the SQL-driven job queue for campaign steps.</summary>
 * <summary>Provides access to pending/due actions that drive execution timing and retries.</summary>
 * <summary>Integrates with workers to atomically claim and transition actions through statuses.</summary>
 */
export class ScheduledActionRepository extends TenantAwareRepository<
  typeof scheduledActions,
  ScheduledAction,
  NewScheduledAction
> {
  constructor() {
    super(scheduledActions);
  }

  async listDuePendingForTenant(tenantId: string, beforeOrAt: Date): Promise<ScheduledAction[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(
            this.table.status,
            'pending' as (typeof scheduledActionStatusEnum)['enumValues'][number]
          ),
          lte(this.table.scheduledAt, beforeOrAt)
        )
      );
  }
}
