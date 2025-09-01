import { eq, and, inArray } from 'drizzle-orm';
import { leadStatuses, LeadStatus, NewLeadStatus } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class LeadStatusRepository extends TenantAwareRepository<
  typeof leadStatuses,
  LeadStatus,
  NewLeadStatus
> {
  constructor() {
    super(leadStatuses);
  }

  /**
   * Find statuses by lead ID for tenant
   */
  async findByLeadIdForTenant(leadId: string, tenantId: string): Promise<LeadStatus[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.leadId, leadId), eq(this.table.tenantId, tenantId)));
  }

  /**
   * Find statuses by lead IDs for tenant
   */
  async findByLeadIdsForTenant(leadIds: string[], tenantId: string): Promise<LeadStatus[]> {
    if (leadIds.length === 0) return [];
    return await this.db
      .select()
      .from(this.table)
      .where(and(inArray(this.table.leadId, leadIds), eq(this.table.tenantId, tenantId)));
  }

  /**
   * Find status by lead and status name for tenant
   */
  async findByLeadAndStatusForTenant(
    leadId: string,
    status: string,
    tenantId: string
  ): Promise<LeadStatus | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.leadId, leadId),
          eq(this.table.status, status),
          eq(this.table.tenantId, tenantId)
        )
      )
      .limit(1);
    return results[0];
  }

  /**
   * Check if status exists for lead
   */
  async statusExistsForLeadAndTenant(
    leadId: string,
    status: string,
    tenantId: string
  ): Promise<boolean> {
    const result = await this.findByLeadAndStatusForTenant(leadId, status, tenantId);
    return !!result;
  }

  /**
   * Create status if it doesn't exist
   */
  async createIfNotExistsForTenant(
    leadId: string,
    status: string,
    tenantId: string
  ): Promise<LeadStatus> {
    const existing = await this.findByLeadAndStatusForTenant(leadId, status, tenantId);
    if (existing) {
      return existing;
    }

    return await this.createForTenant(tenantId, {
      leadId,
      status,
    });
  }

  /**
   * Delete status by lead and status name for tenant
   */
  async deleteByLeadAndStatusForTenant(
    leadId: string,
    status: string,
    tenantId: string
  ): Promise<LeadStatus | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(
        and(
          eq(this.table.leadId, leadId),
          eq(this.table.status, status),
          eq(this.table.tenantId, tenantId)
        )
      )
      .returning();
    return result;
  }
}
