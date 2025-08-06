import { eq, and, asc, lte, gte } from 'drizzle-orm';
import {
  campaignStepInstances,
  CampaignStepInstance,
  NewCampaignStepInstance,
  campaignStepTemplates,
  contactCampaignInstances,
  leadPointOfContacts,
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface CampaignStepInstanceWithDetails extends CampaignStepInstance {
  stepTemplate?: {
    id: string;
    stepName: string;
    channel: string;
    config: any;
    stepOrder: number;
  } | null;
  contactCampaignInstance?: {
    id: string;
    status: string;
    contact?: {
      id: string;
      name: string;
      email: string | null;
    } | null;
  } | null;
}

export interface CampaignStepInstanceSearchOptions {
  contactCampaignInstanceId?: string;
  campaignStepTemplateId?: string;
  status?: string;
  channel?: string;
  scheduledBefore?: Date;
  scheduledAfter?: Date;
  contactId?: string;
  limit?: number;
  offset?: number;
}

export class CampaignStepInstanceRepository extends TenantAwareRepository<
  typeof campaignStepInstances,
  CampaignStepInstance,
  NewCampaignStepInstance
> {
  constructor() {
    super(campaignStepInstances);
  }

  /**
   * Find step instance by ID with full details
   */
  async findByIdWithDetails(
    id: string,
    tenantId: string
  ): Promise<CampaignStepInstanceWithDetails> {
    const result = await this.db
      .select({
        stepInstance: campaignStepInstances,
        stepTemplate: {
          id: campaignStepTemplates.id,
          stepName: campaignStepTemplates.stepName,
          channel: campaignStepTemplates.channel,
          config: campaignStepTemplates.config,
          stepOrder: campaignStepTemplates.stepOrder,
        },
        contactCampaignInstance: {
          id: contactCampaignInstances.id,
          status: contactCampaignInstances.status,
        },
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
        },
      })
      .from(campaignStepInstances)
      .leftJoin(
        campaignStepTemplates,
        eq(campaignStepInstances.campaignStepTemplateId, campaignStepTemplates.id)
      )
      .leftJoin(
        contactCampaignInstances,
        eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id)
      )
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }

    return {
      ...result[0].stepInstance,
      stepTemplate: result[0].stepTemplate,
      contactCampaignInstance: result[0].contactCampaignInstance
        ? {
            ...result[0].contactCampaignInstance,
            contact: result[0].contact,
          }
        : null,
    };
  }

  /**
   * Search step instances for a tenant with pagination and filters
   */
  async searchForTenant(
    tenantId: string,
    options: CampaignStepInstanceSearchOptions = {}
  ): Promise<CampaignStepInstanceWithDetails[]> {
    const {
      contactCampaignInstanceId,
      campaignStepTemplateId,
      status,
      channel,
      scheduledBefore,
      scheduledAfter,
      contactId,
      limit = 50,
      offset = 0,
    } = options;

    let whereConditions = [eq(campaignStepInstances.tenantId, tenantId)];

    if (contactCampaignInstanceId) {
      whereConditions.push(
        eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstanceId)
      );
    }

    if (campaignStepTemplateId) {
      whereConditions.push(
        eq(campaignStepInstances.campaignStepTemplateId, campaignStepTemplateId)
      );
    }

    if (status) {
      whereConditions.push(eq(campaignStepInstances.status, status));
    }

    if (channel) {
      whereConditions.push(eq(campaignStepInstances.channel, channel));
    }

    if (scheduledBefore) {
      whereConditions.push(lte(campaignStepInstances.scheduledAt, scheduledBefore));
    }

    if (scheduledAfter) {
      whereConditions.push(gte(campaignStepInstances.scheduledAt, scheduledAfter));
    }

    if (contactId) {
      whereConditions.push(eq(leadPointOfContacts.id, contactId));
    }

    const results = await this.db
      .select({
        stepInstance: campaignStepInstances,
        stepTemplate: {
          id: campaignStepTemplates.id,
          stepName: campaignStepTemplates.stepName,
          channel: campaignStepTemplates.channel,
          config: campaignStepTemplates.config,
          stepOrder: campaignStepTemplates.stepOrder,
        },
        contactCampaignInstance: {
          id: contactCampaignInstances.id,
          status: contactCampaignInstances.status,
        },
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
        },
      })
      .from(campaignStepInstances)
      .leftJoin(
        campaignStepTemplates,
        eq(campaignStepInstances.campaignStepTemplateId, campaignStepTemplates.id)
      )
      .leftJoin(
        contactCampaignInstances,
        eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id)
      )
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .where(and(...whereConditions))
      .orderBy(asc(campaignStepInstances.scheduledAt))
      .limit(limit)
      .offset(offset);

    return results.map((result) => ({
      ...result.stepInstance,
      stepTemplate: result.stepTemplate,
      contactCampaignInstance: result.contactCampaignInstance
        ? {
            ...result.contactCampaignInstance,
            contact: result.contact,
          }
        : null,
    }));
  }

  /**
   * Get pending step instances scheduled to run now or in the past
   */
  async findDueStepInstances(
    tenantId: string,
    now: Date = new Date()
  ): Promise<CampaignStepInstance[]> {
    return await this.db
      .select()
      .from(campaignStepInstances)
      .where(
        and(
          eq(campaignStepInstances.tenantId, tenantId),
          eq(campaignStepInstances.status, 'pending'),
          lte(campaignStepInstances.scheduledAt, now)
        )
      )
      .orderBy(asc(campaignStepInstances.scheduledAt));
  }

  /**
   * Get step instances for a contact campaign instance, ordered by step order
   */
  async findByContactCampaignInstanceId(
    contactCampaignInstanceId: string,
    tenantId: string
  ): Promise<CampaignStepInstanceWithDetails[]> {
    const results = await this.db
      .select({
        stepInstance: campaignStepInstances,
        stepTemplate: {
          id: campaignStepTemplates.id,
          stepName: campaignStepTemplates.stepName,
          channel: campaignStepTemplates.channel,
          config: campaignStepTemplates.config,
          stepOrder: campaignStepTemplates.stepOrder,
        },
      })
      .from(campaignStepInstances)
      .leftJoin(
        campaignStepTemplates,
        eq(campaignStepInstances.campaignStepTemplateId, campaignStepTemplates.id)
      )
      .where(
        and(
          eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstanceId),
          eq(campaignStepInstances.tenantId, tenantId)
        )
      )
      .orderBy(asc(campaignStepTemplates.stepOrder));

    return results.map((result) => ({
      ...result.stepInstance,
      stepTemplate: result.stepTemplate,
      contactCampaignInstance: null,
    }));
  }

  /**
   * Update step instance for tenant
   */
  async updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewCampaignStepInstance, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CampaignStepInstance> {
    const updated = await this.db
      .update(campaignStepInstances)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Mark step instance as sent
   */
  async markAsSent(
    id: string,
    tenantId: string,
    renderedConfig?: any,
    branchOutcome?: string
  ): Promise<CampaignStepInstance> {
    const updated = await this.db
      .update(campaignStepInstances)
      .set({
        status: 'sent',
        sentAt: new Date(),
        renderedConfig,
        branchOutcome,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Mark step instance as completed
   */
  async markAsCompleted(
    id: string,
    tenantId: string,
    branchOutcome?: string
  ): Promise<CampaignStepInstance> {
    const updated = await this.db
      .update(campaignStepInstances)
      .set({
        status: 'completed',
        branchOutcome,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Mark step instance as skipped
   */
  async markAsSkipped(
    id: string,
    tenantId: string,
    branchOutcome?: string
  ): Promise<CampaignStepInstance> {
    const updated = await this.db
      .update(campaignStepInstances)
      .set({
        status: 'skipped',
        branchOutcome,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Reschedule a step instance
   */
  async reschedule(
    id: string,
    tenantId: string,
    newScheduledAt: Date
  ): Promise<CampaignStepInstance> {
    const updated = await this.db
      .update(campaignStepInstances)
      .set({
        scheduledAt: newScheduledAt,
        status: 'pending', // Reset to pending if it was skipped or failed
        updatedAt: new Date(),
      })
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Delete step instance for tenant
   */
  async deleteForTenant(id: string, tenantId: string): Promise<void> {
    const deleted = await this.db
      .delete(campaignStepInstances)
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .returning();

    if (!deleted || !deleted[0]) {
      throw new NotFoundError(`Campaign step instance not found with id: ${id}`);
    }
  }

  /**
   * Get step instances count for a tenant
   */
  async getCountForTenant(
    tenantId: string,
    options: Omit<CampaignStepInstanceSearchOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const {
      contactCampaignInstanceId,
      campaignStepTemplateId,
      status,
      channel,
      scheduledBefore,
      scheduledAfter,
      contactId,
    } = options;

    let whereConditions = [eq(campaignStepInstances.tenantId, tenantId)];

    if (contactCampaignInstanceId) {
      whereConditions.push(
        eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstanceId)
      );
    }

    if (campaignStepTemplateId) {
      whereConditions.push(
        eq(campaignStepInstances.campaignStepTemplateId, campaignStepTemplateId)
      );
    }

    if (status) {
      whereConditions.push(eq(campaignStepInstances.status, status));
    }

    if (channel) {
      whereConditions.push(eq(campaignStepInstances.channel, channel));
    }

    if (scheduledBefore) {
      whereConditions.push(lte(campaignStepInstances.scheduledAt, scheduledBefore));
    }

    if (scheduledAfter) {
      whereConditions.push(gte(campaignStepInstances.scheduledAt, scheduledAfter));
    }

    if (contactId) {
      // Need to join with contact campaign instances and contacts
      const result = await this.db
        .select({ count: this.db.$count(campaignStepInstances.id) })
        .from(campaignStepInstances)
        .leftJoin(
          contactCampaignInstances,
          eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id)
        )
        .where(and(...whereConditions, eq(contactCampaignInstances.contactId, contactId)));

      return result[0]?.count || 0;
    }

    const result = await this.db
      .select({ count: this.db.$count(campaignStepInstances.id) })
      .from(campaignStepInstances)
      .where(and(...whereConditions));

    return result[0]?.count || 0;
  }

  /**
   * Bulk create step instances for a campaign instance
   */
  async createBulkForTenant(
    tenantId: string,
    data: Omit<NewCampaignStepInstance, 'tenantId'>[]
  ): Promise<CampaignStepInstance[]> {
    const dataWithTenant = data.map((item) => ({ ...item, tenantId }));
    return await this.createMany(dataWithTenant);
  }

  /**
   * Get step instances by status for a tenant
   */
  async findByStatus(status: string, tenantId: string): Promise<CampaignStepInstance[]> {
    return await this.db
      .select()
      .from(campaignStepInstances)
      .where(
        and(eq(campaignStepInstances.status, status), eq(campaignStepInstances.tenantId, tenantId))
      )
      .orderBy(asc(campaignStepInstances.scheduledAt));
  }

  /**
   * Get step instances by channel for a tenant
   */
  async findByChannel(channel: string, tenantId: string): Promise<CampaignStepInstance[]> {
    return await this.db
      .select()
      .from(campaignStepInstances)
      .where(
        and(
          eq(campaignStepInstances.channel, channel),
          eq(campaignStepInstances.tenantId, tenantId)
        )
      )
      .orderBy(asc(campaignStepInstances.scheduledAt));
  }

  /**
   * Check if step instance exists for tenant
   */
  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: campaignStepInstances.id })
      .from(campaignStepInstances)
      .where(and(eq(campaignStepInstances.id, id), eq(campaignStepInstances.tenantId, tenantId)))
      .limit(1);

    return result.length > 0;
  }
}
