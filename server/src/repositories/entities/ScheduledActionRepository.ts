import { and, eq, lte, inArray } from 'drizzle-orm';
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
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as ScheduledAction[];
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
    return await this.db
      .update(this.table)
      .set({ status: 'canceled' as (typeof scheduledActionStatusEnum)['enumValues'][number] })
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)));
  }
}
