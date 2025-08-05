import { eq, and, desc, asc, gte, lte, inArray } from 'drizzle-orm';
import { 
  stepEvents, 
  StepEvent, 
  NewStepEvent,
  campaignStepInstances,
  contactCampaignInstances,
  leadPointOfContacts
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface StepEventWithDetails extends StepEvent {
  stepInstance?: {
    id: string;
    status: string;
    channel: string;
    scheduledAt: Date;
    sentAt: Date | null;
  } | null;
  contact?: {
    id: string;
    name: string;
    email: string | null;
  } | null;
}

export interface StepEventSearchOptions {
  campaignStepInstanceId?: string;
  eventType?: string;
  contactId?: string;
  channel?: string;
  occurredAfter?: Date;
  occurredBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface EventAnalytics {
  eventType: string;
  count: number;
  channel?: string;
}

export class StepEventRepository extends TenantAwareRepository<
  typeof stepEvents,
  StepEvent,
  NewStepEvent
> {
  constructor() {
    super(stepEvents);
  }

  /**
   * Find step event by ID with full details
   */
  async findByIdWithDetails(id: string, tenantId: string): Promise<StepEventWithDetails> {
    const result = await this.db
      .select({
        event: stepEvents,
        stepInstance: {
          id: campaignStepInstances.id,
          status: campaignStepInstances.status,
          channel: campaignStepInstances.channel,
          scheduledAt: campaignStepInstances.scheduledAt,
          sentAt: campaignStepInstances.sentAt,
        },
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
        },
      })
      .from(stepEvents)
      .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
      .leftJoin(contactCampaignInstances, eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id))
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .where(and(eq(stepEvents.id, id), eq(stepEvents.tenantId, tenantId)))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`Step event not found with id: ${id}`);
    }

    return {
      ...result[0].event,
      stepInstance: result[0].stepInstance,
      contact: result[0].contact,
    };
  }

  /**
   * Search step events for a tenant with pagination and filters
   */
  async searchForTenant(
    tenantId: string,
    options: StepEventSearchOptions = {}
  ): Promise<StepEventWithDetails[]> {
    const { 
      campaignStepInstanceId, 
      eventType, 
      contactId,
      channel,
      occurredAfter,
      occurredBefore,
      limit = 50, 
      offset = 0 
    } = options;

    let whereConditions = [eq(stepEvents.tenantId, tenantId)];

    if (campaignStepInstanceId) {
      whereConditions.push(eq(stepEvents.campaignStepInstanceId, campaignStepInstanceId));
    }

    if (eventType) {
      whereConditions.push(eq(stepEvents.eventType, eventType));
    }

    if (contactId) {
      whereConditions.push(eq(leadPointOfContacts.id, contactId));
    }

    if (channel) {
      whereConditions.push(eq(campaignStepInstances.channel, channel));
    }

    if (occurredAfter) {
      whereConditions.push(gte(stepEvents.occurredAt, occurredAfter));
    }

    if (occurredBefore) {
      whereConditions.push(lte(stepEvents.occurredAt, occurredBefore));
    }

    const results = await this.db
      .select({
        event: stepEvents,
        stepInstance: {
          id: campaignStepInstances.id,
          status: campaignStepInstances.status,
          channel: campaignStepInstances.channel,
          scheduledAt: campaignStepInstances.scheduledAt,
          sentAt: campaignStepInstances.sentAt,
        },
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
        },
      })
      .from(stepEvents)
      .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
      .leftJoin(contactCampaignInstances, eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id))
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .where(and(...whereConditions))
      .orderBy(desc(stepEvents.occurredAt))
      .limit(limit)
      .offset(offset);

    return results.map((result) => ({
      ...result.event,
      stepInstance: result.stepInstance,
      contact: result.contact,
    }));
  }

  /**
   * Get events for a specific step instance
   */
  async findByStepInstanceId(
    campaignStepInstanceId: string,
    tenantId: string
  ): Promise<StepEvent[]> {
    return await this.db
      .select()
      .from(stepEvents)
      .where(
        and(
          eq(stepEvents.campaignStepInstanceId, campaignStepInstanceId),
          eq(stepEvents.tenantId, tenantId)
        )
      )
      .orderBy(asc(stepEvents.occurredAt));
  }

  /**
   * Get events by type for a tenant
   */
  async findByEventType(
    eventType: string,
    tenantId: string,
    limit = 100
  ): Promise<StepEvent[]> {
    return await this.db
      .select()
      .from(stepEvents)
      .where(
        and(
          eq(stepEvents.eventType, eventType),
          eq(stepEvents.tenantId, tenantId)
        )
      )
      .orderBy(desc(stepEvents.occurredAt))
      .limit(limit);
  }

  /**
   * Get events for a specific contact across all campaigns
   */
  async findByContactId(
    contactId: string,
    tenantId: string
  ): Promise<StepEventWithDetails[]> {
    const results = await this.db
      .select({
        event: stepEvents,
        stepInstance: {
          id: campaignStepInstances.id,
          status: campaignStepInstances.status,
          channel: campaignStepInstances.channel,
          scheduledAt: campaignStepInstances.scheduledAt,
          sentAt: campaignStepInstances.sentAt,
        },
      })
      .from(stepEvents)
      .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
      .leftJoin(contactCampaignInstances, eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id))
      .where(
        and(
          eq(contactCampaignInstances.contactId, contactId),
          eq(stepEvents.tenantId, tenantId)
        )
      )
      .orderBy(desc(stepEvents.occurredAt));

    return results.map((result) => ({
      ...result.event,
      stepInstance: result.stepInstance,
      contact: null, // Already filtered by contactId
    }));
  }

  /**
   * Get event analytics by type for a tenant
   */
  async getEventAnalytics(
    tenantId: string,
    options: {
      occurredAfter?: Date;
      occurredBefore?: Date;
      channel?: string;
    } = {}
  ): Promise<EventAnalytics[]> {
    const { occurredAfter, occurredBefore, channel } = options;

    let whereConditions = [eq(stepEvents.tenantId, tenantId)];

    if (occurredAfter) {
      whereConditions.push(gte(stepEvents.occurredAt, occurredAfter));
    }

    if (occurredBefore) {
      whereConditions.push(lte(stepEvents.occurredAt, occurredBefore));
    }

    if (channel) {
      whereConditions.push(eq(campaignStepInstances.channel, channel));
    }

    const results = await this.db
      .select({
        eventType: stepEvents.eventType,
        channel: campaignStepInstances.channel,
        count: this.db.count(),
      })
      .from(stepEvents)
      .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
      .where(and(...whereConditions))
      .groupBy(stepEvents.eventType, campaignStepInstances.channel)
      .orderBy(desc(this.db.count()));

    return results.map((result) => ({
      eventType: result.eventType,
      count: result.count,
      channel: result.channel || undefined,
    }));
  }

  /**
   * Get recent events for a tenant (for dashboards)
   */
  async getRecentEvents(
    tenantId: string,
    limit = 50
  ): Promise<StepEventWithDetails[]> {
    const results = await this.db
      .select({
        event: stepEvents,
        stepInstance: {
          id: campaignStepInstances.id,
          status: campaignStepInstances.status,
          channel: campaignStepInstances.channel,
          scheduledAt: campaignStepInstances.scheduledAt,
          sentAt: campaignStepInstances.sentAt,
        },
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
        },
      })
      .from(stepEvents)
      .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
      .leftJoin(contactCampaignInstances, eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id))
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .where(eq(stepEvents.tenantId, tenantId))
      .orderBy(desc(stepEvents.occurredAt))
      .limit(limit);

    return results.map((result) => ({
      ...result.event,
      stepInstance: result.stepInstance,
      contact: result.contact,
    }));
  }

  /**
   * Update step event for tenant
   */
  async updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewStepEvent, 'id' | 'tenantId' | 'occurredAt' | 'createdAt'>>
  ): Promise<StepEvent> {
    const updated = await this.db
      .update(stepEvents)
      .set(data)
      .where(and(eq(stepEvents.id, id), eq(stepEvents.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Step event not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Delete step event for tenant
   */
  async deleteForTenant(id: string, tenantId: string): Promise<void> {
    const deleted = await this.db
      .delete(stepEvents)
      .where(and(eq(stepEvents.id, id), eq(stepEvents.tenantId, tenantId)))
      .returning();

    if (!deleted || !deleted[0]) {
      throw new NotFoundError(`Step event not found with id: ${id}`);
    }
  }

  /**
   * Get step events count for a tenant
   */
  async getCountForTenant(
    tenantId: string,
    options: Omit<StepEventSearchOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const { 
      campaignStepInstanceId, 
      eventType, 
      contactId,
      channel,
      occurredAfter,
      occurredBefore
    } = options;

    let whereConditions = [eq(stepEvents.tenantId, tenantId)];

    if (campaignStepInstanceId) {
      whereConditions.push(eq(stepEvents.campaignStepInstanceId, campaignStepInstanceId));
    }

    if (eventType) {
      whereConditions.push(eq(stepEvents.eventType, eventType));
    }

    if (occurredAfter) {
      whereConditions.push(gte(stepEvents.occurredAt, occurredAfter));
    }

    if (occurredBefore) {
      whereConditions.push(lte(stepEvents.occurredAt, occurredBefore));
    }

    if (contactId || channel) {
      // Need to join with step instances for these filters
      const result = await this.db
        .select({ count: this.db.count() })
        .from(stepEvents)
        .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
        .leftJoin(contactCampaignInstances, eq(campaignStepInstances.contactCampaignInstanceId, contactCampaignInstances.id))
        .where(and(
          ...whereConditions,
          ...(contactId ? [eq(contactCampaignInstances.contactId, contactId)] : []),
          ...(channel ? [eq(campaignStepInstances.channel, channel)] : [])
        ));
      
      return result[0]?.count || 0;
    }

    const result = await this.db
      .select({ count: this.db.count() })
      .from(stepEvents)
      .where(and(...whereConditions));

    return result[0]?.count || 0;
  }

  /**
   * Bulk create step events
   */
  async createBulkForTenant(
    tenantId: string,
    data: Omit<NewStepEvent, 'tenantId'>[]
  ): Promise<StepEvent[]> {
    const dataWithTenant = data.map((item) => ({ ...item, tenantId }));
    return await this.createMany(dataWithTenant);
  }

  /**
   * Get engagement rate for a channel (opens, clicks, etc.)
   */
  async getChannelEngagementRate(
    tenantId: string,
    channel: string,
    options: {
      occurredAfter?: Date;
      occurredBefore?: Date;
      engagementEvents?: string[]; // e.g., ['open', 'click']
    } = {}
  ): Promise<{
    totalSent: number;
    totalEngagements: number;
    engagementRate: number;
  }> {
    const { occurredAfter, occurredBefore, engagementEvents = ['open', 'click'] } = options;

    let whereConditions = [
      eq(stepEvents.tenantId, tenantId),
      eq(campaignStepInstances.channel, channel)
    ];

    if (occurredAfter) {
      whereConditions.push(gte(stepEvents.occurredAt, occurredAfter));
    }

    if (occurredBefore) {
      whereConditions.push(lte(stepEvents.occurredAt, occurredBefore));
    }

    // Get total sent count
    const sentResult = await this.db
      .select({ count: this.db.count() })
      .from(campaignStepInstances)
      .where(
        and(
          eq(campaignStepInstances.tenantId, tenantId),
          eq(campaignStepInstances.channel, channel),
          eq(campaignStepInstances.status, 'sent')
        )
      );

    // Get engagement count
    const engagementResult = await this.db
      .select({ count: this.db.count() })
      .from(stepEvents)
      .leftJoin(campaignStepInstances, eq(stepEvents.campaignStepInstanceId, campaignStepInstances.id))
      .where(and(
        ...whereConditions,
        inArray(stepEvents.eventType, engagementEvents)
      ));

    const totalSent = sentResult[0]?.count || 0;
    const totalEngagements = engagementResult[0]?.count || 0;
    const engagementRate = totalSent > 0 ? (totalEngagements / totalSent) * 100 : 0;

    return {
      totalSent,
      totalEngagements,
      engagementRate: Number(engagementRate.toFixed(2)),
    };
  }

  /**
   * Check if step event exists for tenant
   */
  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: stepEvents.id })
      .from(stepEvents)
      .where(and(eq(stepEvents.id, id), eq(stepEvents.tenantId, tenantId)))
      .limit(1);

    return result.length > 0;
  }
}