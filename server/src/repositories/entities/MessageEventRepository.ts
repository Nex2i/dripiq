import { and, eq, desc } from 'drizzle-orm';
import { messageEvents, MessageEvent, NewMessageEvent } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class MessageEventRepository extends TenantAwareRepository<
  typeof messageEvents,
  MessageEvent,
  NewMessageEvent
> {
  constructor() {
    super(messageEvents);
  }

  async listByMessageForTenant(
    tenantId: string,
    messageId: string,
    limit = 100
  ): Promise<MessageEvent[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.messageId, messageId)))
      .orderBy(desc(this.table.eventAt))
      .limit(limit)) as MessageEvent[];
  }
}