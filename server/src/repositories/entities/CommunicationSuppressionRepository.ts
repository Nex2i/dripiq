import { and, eq } from 'drizzle-orm';
import {
  communicationSuppressions,
  CommunicationSuppression,
  NewCommunicationSuppression,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class CommunicationSuppressionRepository extends TenantAwareRepository<
  typeof communicationSuppressions,
  CommunicationSuppression,
  NewCommunicationSuppression
> {
  constructor() {
    super(communicationSuppressions);
  }

  async isSuppressed(
    tenantId: string,
    channel: string,
    address: string
  ): Promise<boolean> {
    const results = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.channel, channel as any),
          eq(this.table.address, address)
        )
      )
      .limit(1);
    return !!results[0];
  }
}