import { and, eq, inArray } from 'drizzle-orm';
import { contactUnsubscribes, ContactUnsubscribe, NewContactUnsubscribe } from '@/db/schema';
import { logger } from '@/libs/logger';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>ContactUnsubscribeRepository manages channel-based unsubscribe tracking.</summary>
 * <summary>Stores unsubscribes by tenant + channel + channel_value for persistence across contact changes.</summary>
 * <summary>Used by campaign workers to check unsubscribe status before sending messages.</summary>
 */
export class ContactUnsubscribeRepository extends TenantAwareRepository<
  typeof contactUnsubscribes,
  ContactUnsubscribe,
  NewContactUnsubscribe
> {
  constructor() {
    super(contactUnsubscribes);
  }

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewContactUnsubscribe, 'tenantId'>
  ): Promise<ContactUnsubscribe> {
    const [result] = await this.db
      .insert(this.table)
      .values({
        ...(data as Omit<NewContactUnsubscribe, 'tenantId'>),
        tenantId,
      } as NewContactUnsubscribe)
      .returning();
    return result as ContactUnsubscribe;
  }

  async createUnsubscribe(data: {
    tenantId: string;
    channel: string;
    channelValue: string;
    unsubscribeSource: string;
    campaignId?: string;
    contactId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ContactUnsubscribe> {
    const newUnsubscribe: NewContactUnsubscribe = {
      tenantId: data.tenantId,
      channel: data.channel,
      channelValue: data.channelValue.toLowerCase().trim(),
      unsubscribeSource: data.unsubscribeSource,
      campaignId: data.campaignId,
      contactId: data.contactId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    };

    try {
      const [result] = await this.db.insert(this.table).values(newUnsubscribe).returning();

      if (!result) {
        throw new Error('Failed to create unsubscribe record');
      }

      logger.info('Created unsubscribe record', {
        id: result.id,
        tenantId: data.tenantId,
        channel: data.channel,
        channelValue: data.channelValue,
        source: data.unsubscribeSource,
      });

      return result;
    } catch (error) {
      // Handle duplicate key constraint (already unsubscribed)
      if (error instanceof Error && error.message.includes('unique constraint')) {
        logger.info('Unsubscribe record already exists', {
          tenantId: data.tenantId,
          channel: data.channel,
          channelValue: data.channelValue,
        });

        // Return existing record
        const existing = await this.findByChannelValue(
          data.tenantId,
          data.channel,
          data.channelValue
        );
        if (existing) return existing;
      }

      logger.error('Failed to create unsubscribe record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<ContactUnsubscribe | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<ContactUnsubscribe[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as ContactUnsubscribe[];
  }

  async findAllForTenant(tenantId: string): Promise<ContactUnsubscribe[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as ContactUnsubscribe[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewContactUnsubscribe, 'tenantId'>>
  ): Promise<ContactUnsubscribe | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(
        data as Partial<Omit<NewContactUnsubscribe, 'tenantId'>> as Partial<NewContactUnsubscribe>
      )
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ContactUnsubscribe | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<ContactUnsubscribe | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ContactUnsubscribe | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<ContactUnsubscribe[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as ContactUnsubscribe[];
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

  async deleteAllForTenant(tenantId: string): Promise<ContactUnsubscribe[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as ContactUnsubscribe[];
  }

  // Domain-specific methods
  async findByChannelValue(
    tenantId: string,
    channel: string,
    channelValue: string
  ): Promise<ContactUnsubscribe | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.channel, channel),
          eq(this.table.channelValue, channelValue.toLowerCase().trim())
        )
      )
      .limit(1);

    return results[0] || null;
  }

  async findUnsubscribedChannelValues(
    tenantId: string,
    channel: string,
    channelValues: string[]
  ): Promise<ContactUnsubscribe[]> {
    if (channelValues.length === 0) return [];

    const normalizedValues = channelValues.map((v) => v.toLowerCase().trim());

    return await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.channel, channel),
          inArray(this.table.channelValue, normalizedValues)
        )
      );
  }

  /**
   * Find unsubscribes by channel for a tenant
   */
  async findByChannelForTenant(tenantId: string, channel: string): Promise<ContactUnsubscribe[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.channel, channel)));
  }

  /**
   * Find unsubscribes by campaign for analytics
   */
  async findByCampaignForTenant(
    tenantId: string,
    campaignId: string
  ): Promise<ContactUnsubscribe[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)));
  }
}

export const contactUnsubscribeRepository = new ContactUnsubscribeRepository();
