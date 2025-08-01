import { eq, and, inArray } from 'drizzle-orm';
import { TenantAwareRepository } from '../base/TenantAwareRepository';
import { leadStatuses, LeadStatus, NewLeadStatus, leads } from '@/db/schema';

export class LeadStatusRepository extends TenantAwareRepository<typeof leadStatuses, LeadStatus, NewLeadStatus> {
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
  async findByLeadAndStatusForTenant(leadId: string, status: string, tenantId: string): Promise<LeadStatus | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(this.table.leadId, leadId),
        eq(this.table.status, status),
        eq(this.table.tenantId, tenantId)
      ))
      .limit(1);
    return results[0];
  }

  /**
   * Check if status exists for lead
   */
  async statusExistsForLeadAndTenant(leadId: string, status: string, tenantId: string): Promise<boolean> {
    const result = await this.findByLeadAndStatusForTenant(leadId, status, tenantId);
    return !!result;
  }

  /**
   * Create status if it doesn't exist
   */
  async createIfNotExistsForTenant(leadId: string, status: string, tenantId: string): Promise<LeadStatus> {
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
   * Create multiple statuses for a lead
   */
  async createMultipleForLeadAndTenant(leadId: string, statuses: string[], tenantId: string): Promise<LeadStatus[]> {
    const statusData = statuses.map(status => ({
      leadId,
      status,
    }));

    return await this.createManyForTenant(tenantId, statusData);
  }

  /**
   * Delete status by lead and status name for tenant
   */
  async deleteByLeadAndStatusForTenant(leadId: string, status: string, tenantId: string): Promise<LeadStatus | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(
        eq(this.table.leadId, leadId),
        eq(this.table.status, status),
        eq(this.table.tenantId, tenantId)
      ))
      .returning();
    return result;
  }

  /**
   * Delete all statuses for a lead
   */
  async deleteAllForLeadAndTenant(leadId: string, tenantId: string): Promise<LeadStatus[]> {
    return await this.db
      .delete(this.table)
      .where(and(eq(this.table.leadId, leadId), eq(this.table.tenantId, tenantId)))
      .returning();
  }

  /**
   * Get unique statuses for tenant
   */
  async getUniqueStatusesForTenant(tenantId: string): Promise<string[]> {
    const results = await this.db
      .select({ status: this.table.status })
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId));
    
    const uniqueStatuses = [...new Set(results.map(r => r.status))];
    return uniqueStatuses;
  }

  /**
   * Count leads by status for tenant
   */
  async countLeadsByStatusForTenant(tenantId: string): Promise<Record<string, number>> {
    const results = await this.db
      .select({ status: this.table.status })
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId));
    
    const counts: Record<string, number> = {};
    results.forEach(result => {
      counts[result.status] = (counts[result.status] || 0) + 1;
    });
    
    return counts;
  }

  /**
   * Update status timestamps (for tracking when statuses were added)
   */
  async touchStatusForTenant(leadId: string, status: string, tenantId: string): Promise<LeadStatus | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ updatedAt: new Date() })
      .where(and(
        eq(this.table.leadId, leadId),
        eq(this.table.status, status),
        eq(this.table.tenantId, tenantId)
      ))
      .returning();
    return result;
  }
}