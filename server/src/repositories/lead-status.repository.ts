import { eq, and } from 'drizzle-orm';
import { leadStatuses, leads, tenants, LeadStatus, NewLeadStatus } from '@/db/schema';
import { BaseRepository, ITenantScopedRepository } from './base.repository';

export class LeadStatusRepository extends BaseRepository implements ITenantScopedRepository<LeadStatus, NewLeadStatus> {
  /**
   * Find lead status by ID within tenant scope
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<LeadStatus | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(leadStatuses)
        .where(and(eq(leadStatuses.id, id), eq(leadStatuses.tenantId, tenantId)))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new lead status
   */
  async create(statusData: NewLeadStatus, tenantId: string, userId?: string): Promise<LeadStatus> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Ensure tenantId matches and verify the lead belongs to the tenant
      const dataWithTenant = { ...statusData, tenantId };

      // Verify the lead belongs to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, statusData.leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      const [leadStatus] = await this.db.insert(leadStatuses).values(dataWithTenant).returning();
      if (!leadStatus) {
        throw new Error('Failed to create lead status');
      }
      return leadStatus;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update lead status
   */
  async update(id: string, updateData: Partial<NewLeadStatus>, tenantId: string, userId?: string): Promise<LeadStatus> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [leadStatus] = await this.db
        .update(leadStatuses)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(leadStatuses.id, id), eq(leadStatuses.tenantId, tenantId)))
        .returning();

      if (!leadStatus) {
        throw new Error('Lead status not found or access denied');
      }
      return leadStatus;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete lead status
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<LeadStatus> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [leadStatus] = await this.db
        .delete(leadStatuses)
        .where(and(eq(leadStatuses.id, id), eq(leadStatuses.tenantId, tenantId)))
        .returning();

      if (!leadStatus) {
        throw new Error('Lead status not found or access denied');
      }
      return leadStatus;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all lead statuses for a tenant
   */
  async findByTenant(tenantId: string, userId?: string): Promise<LeadStatus[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(leadStatuses)
        .where(eq(leadStatuses.tenantId, tenantId))
        .orderBy(leadStatuses.createdAt);
    } catch (error) {
      this.handleError(error, 'findByTenant');
    }
  }

  /**
   * Find lead statuses by lead ID
   */
  async findByLead(leadId: string, tenantId: string, userId?: string): Promise<LeadStatus[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead belongs to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      return await this.db
        .select()
        .from(leadStatuses)
        .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
        .orderBy(leadStatuses.createdAt);
    } catch (error) {
      this.handleError(error, 'findByLead');
    }
  }

  /**
   * Find lead status by lead and status
   */
  async findByLeadAndStatus(leadId: string, status: string, tenantId: string, userId?: string): Promise<LeadStatus | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(leadStatuses)
        .where(and(
          eq(leadStatuses.leadId, leadId),
          eq(leadStatuses.status, status),
          eq(leadStatuses.tenantId, tenantId)
        ))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByLeadAndStatus');
    }
  }

  /**
   * Find all statuses by specific status value
   */
  async findByStatus(status: string, tenantId: string, userId?: string): Promise<LeadStatus[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(leadStatuses)
        .where(and(eq(leadStatuses.status, status), eq(leadStatuses.tenantId, tenantId)))
        .orderBy(leadStatuses.createdAt);
    } catch (error) {
      this.handleError(error, 'findByStatus');
    }
  }
}