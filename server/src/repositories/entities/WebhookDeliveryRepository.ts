import { and, eq, desc } from 'drizzle-orm';
import { webhookDeliveries, WebhookDelivery, NewWebhookDelivery } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

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