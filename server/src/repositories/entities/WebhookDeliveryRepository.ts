import { and, eq, desc, inArray } from 'drizzle-orm';
import { webhookDeliveries, WebhookDelivery, NewWebhookDelivery, tenants } from '@/db/schema';
import { logger } from '@/libs/logger';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>WebhookDeliveryRepository archives raw inbound webhooks from providers.</summary>
 * <summary>Preserves original payloads for replay, audit, and troubleshooting.</summary>
 * <summary>Feeds normalization into message events and safeguards event processing.</summary>
 */
export class WebhookDeliveryRepository extends TenantAwareRepository<
  typeof webhookDeliveries,
  WebhookDelivery,
  NewWebhookDelivery
> {
  constructor() {
    super(webhookDeliveries);
  }

  // Tenant-aware CRUD with graceful tenant handling
  async createForTenantSafe(
    tenantId: string,
    data: Omit<NewWebhookDelivery, 'tenantId'>
  ): Promise<WebhookDelivery | null> {
    logger.debug('Creating webhook delivery for tenant', {
      tenantId,
      provider: data.provider,
      eventType: data.eventType,
      messageId: data.messageId,
      status: data.status,
    });

    // Validate tenant exists to provide better error context
    try {
      const tenantExists = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenantExists || tenantExists.length === 0) {
        logger.warn('Tenant not found when creating webhook delivery - skipping webhook storage', {
          tenantId,
          provider: data.provider,
          eventType: data.eventType,
          messageId: data.messageId,
          reason: 'Tenant does not exist in database',
          action: 'Webhook processing will be skipped for this tenant',
        });
        return null; // Return null instead of throwing error
      }

      logger.debug('Tenant validation passed for webhook delivery creation', {
        tenantId,
        tenantFound: !!tenantExists[0],
      });
    } catch (error) {
      logger.error('Tenant validation failed during webhook delivery creation', {
        tenantId,
        provider: data.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    try {
      const [result] = await this.db
        .insert(this.table)
        .values({
          ...(data as Omit<NewWebhookDelivery, 'tenantId'>),
          tenantId,
        } as NewWebhookDelivery)
        .returning();

      logger.debug('Successfully created webhook delivery', {
        tenantId,
        webhookDeliveryId: result?.id,
        provider: data.provider,
        eventType: data.eventType,
      });

      return result as WebhookDelivery;
    } catch (error) {
      logger.error('Database error when creating webhook delivery', {
        tenantId,
        provider: data.provider,
        eventType: data.eventType,
        messageId: data.messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        dataKeys: Object.keys(data),
      });
      throw error;
    }
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewWebhookDelivery, 'tenantId'>[]
  ): Promise<WebhookDelivery[]> {
    const values: NewWebhookDelivery[] = data.map(
      (d) => ({ ...(d as Omit<NewWebhookDelivery, 'tenantId'>), tenantId }) as NewWebhookDelivery
    );
    return (await this.db.insert(this.table).values(values).returning()) as WebhookDelivery[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<WebhookDelivery | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<WebhookDelivery[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as WebhookDelivery[];
  }

  async findAllForTenant(tenantId: string): Promise<WebhookDelivery[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as WebhookDelivery[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewWebhookDelivery, 'tenantId'>>
  ): Promise<WebhookDelivery | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as Partial<Omit<NewWebhookDelivery, 'tenantId'>> as Partial<NewWebhookDelivery>)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as WebhookDelivery | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<WebhookDelivery | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as WebhookDelivery | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<WebhookDelivery[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as WebhookDelivery[];
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

  async deleteAllForTenant(tenantId: string): Promise<WebhookDelivery[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as WebhookDelivery[];
  }

  // Domain helper
  async listByProviderForTenant(
    tenantId: string,
    provider: string,
    limit = 100
  ): Promise<WebhookDelivery[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.provider, provider)))
      .orderBy(desc(this.table.receivedAt))
      .limit(limit)) as WebhookDelivery[];
  }
}
