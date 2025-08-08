import { and, eq } from 'drizzle-orm';
import { sendRateLimits, SendRateLimit, NewSendRateLimit } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

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
    channel: string
  ): Promise<SendRateLimit | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.channel, channel as any)))
      .limit(1);
    return results[0];
  }
}