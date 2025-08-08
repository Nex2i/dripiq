import { and, eq } from 'drizzle-orm';
import { sendRateLimits, SendRateLimit, NewSendRateLimit, channelEnum } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>SendRateLimitRepository stores throttle policies by tenant, channel, and identity.</summary>
 * <summary>Allows workers to compute available capacity within sliding windows.</summary>
 * <summary>Guards providers from overload and aligns with provider-specific quotas.</summary>
 */
export class SendRateLimitRepository extends TenantAwareRepository<
  typeof sendRateLimits,
  SendRateLimit,
  NewSendRateLimit
> {
  constructor() {
    super(sendRateLimits);
  }

  async getTenantLimit(
    tenantId: string,
    channel: (typeof channelEnum)['enumValues'][number]
  ): Promise<SendRateLimit | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.channel, channel)))
      .limit(1);
    return results[0];
  }
}
