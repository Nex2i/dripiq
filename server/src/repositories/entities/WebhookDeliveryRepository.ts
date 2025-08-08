import { and, eq, desc } from 'drizzle-orm';
import { webhookDeliveries, WebhookDelivery, NewWebhookDelivery } from '@/db/schema';
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
