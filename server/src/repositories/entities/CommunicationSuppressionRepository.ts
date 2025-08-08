import { and, eq } from 'drizzle-orm';
import {
  communicationSuppressions,
  CommunicationSuppression,
  NewCommunicationSuppression,
  channelEnum,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>CommunicationSuppressionRepository enforces per-tenant suppression lists.</summary>
 * <summary>Prevents messaging suppressed addresses and tracks reasons/expiry.</summary>
 * <summary>Consulted before dispatch to ensure compliance and respect preferences.</summary>
 */
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
    channel: (typeof channelEnum)['enumValues'][number],
    address: string
  ): Promise<boolean> {
    const results = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.channel, channel),
          eq(this.table.address, address)
        )
      )
      .limit(1);
    return !!results[0];
  }
}
