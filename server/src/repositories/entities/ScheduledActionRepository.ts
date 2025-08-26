import { and, eq, lte, inArray } from 'drizzle-orm';
import {
  scheduledActions,
  ScheduledAction,
  NewScheduledAction,
  scheduledActionStatusEnum,
} from '@/db/schema';
import { getQueue } from '@/libs/bullmq';
import { logger } from '@/libs/logger';
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

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewScheduledAction, 'tenantId'>
  ): Promise<ScheduledAction> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as Omit<NewScheduledAction, 'tenantId'>), tenantId } as NewScheduledAction)
      .returning();
    return result as ScheduledAction;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewScheduledAction, 'tenantId'>[]
  ): Promise<ScheduledAction[]> {
    const values: NewScheduledAction[] = data.map(
      (d) => ({ ...(d as Omit<NewScheduledAction, 'tenantId'>), tenantId }) as NewScheduledAction
    );
    return (await this.db.insert(this.table).values(values).returning()) as ScheduledAction[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<ScheduledAction | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<ScheduledAction[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as ScheduledAction[];
  }

  async findAllForTenant(tenantId: string): Promise<ScheduledAction[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .orderBy(this.table.scheduledAt);
  }

  // Find pending actions by campaign and action type
  async findPendingByCampaignAndType(
    tenantId: string,
    campaignId: string,
    actionType: string
  ): Promise<ScheduledAction[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.campaignId, campaignId),
          eq(this.table.actionType, actionType),
          eq(
            this.table.status,
            'pending' as (typeof scheduledActionStatusEnum)['enumValues'][number]
          )
        )
      )
      .orderBy(this.table.scheduledAt);
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewScheduledAction, 'tenantId'>>
  ): Promise<ScheduledAction | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as Partial<Omit<NewScheduledAction, 'tenantId'>> as Partial<NewScheduledAction>)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ScheduledAction | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<ScheduledAction | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ScheduledAction | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<ScheduledAction[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as ScheduledAction[];
  }

  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return !!result[0];
  }

  async countForTenant(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId));
    return result.length;
  }

  async deleteAllForTenant(tenantId: string): Promise<ScheduledAction[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as ScheduledAction[];
  }

  // Domain helpers
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

  // cancel by campaign id
  async cancelByCampaignForTenant(
    tenantId: string,
    campaignId: string
  ): Promise<ScheduledAction[]> {
    // First, find all pending actions for this campaign to get their job IDs
    const pendingActions = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.campaignId, campaignId),
          eq(
            this.table.status,
            'pending' as (typeof scheduledActionStatusEnum)['enumValues'][number]
          )
        )
      );

    // Cancel the actual BullMQ jobs
    const campaignExecutionQueue = getQueue('campaign_execution');
    for (const action of pendingActions) {
      if (action.bullmqJobId) {
        try {
          const job = await campaignExecutionQueue.getJob(action.bullmqJobId);
          if (job) {
            await job.remove();
            logger.info('[ScheduledActionRepository] Canceled BullMQ job', {
              tenantId,
              campaignId,
              actionId: action.id,
              jobId: action.bullmqJobId,
            });
          }
        } catch (error) {
          logger.warn('[ScheduledActionRepository] Failed to cancel BullMQ job', {
            tenantId,
            campaignId,
            actionId: action.id,
            jobId: action.bullmqJobId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Don't fail the entire operation if one job fails to cancel
        }
      }
    }

    // Update the database status
    const canceledActions = await this.db
      .update(this.table)
      .set({
        status: 'canceled' as (typeof scheduledActionStatusEnum)['enumValues'][number],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.campaignId, campaignId),
          eq(
            this.table.status,
            'pending' as (typeof scheduledActionStatusEnum)['enumValues'][number]
          )
        )
      )
      .returning();

    logger.info('[ScheduledActionRepository] Canceled campaign actions', {
      tenantId,
      campaignId,
      canceledCount: canceledActions.length,
    });

    return canceledActions;
  }

  // Recovery methods for startup recovery
  async findOrphaned(): Promise<ScheduledAction[]> {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    return await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(
            this.table.status,
            'pending' as (typeof scheduledActionStatusEnum)['enumValues'][number]
          ),
          lte(this.table.scheduledAt, cutoffTime) // Past due by at least 5 minutes
        )
      )
      .orderBy(this.table.scheduledAt);
  }

  async markAsExpired(actionId: string, reason: string): Promise<void> {
    await this.updateById(actionId, {
      status: 'failed' as (typeof scheduledActionStatusEnum)['enumValues'][number],
      lastError: reason,
    });
  }
}
