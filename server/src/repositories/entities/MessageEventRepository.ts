import { and, eq, desc } from 'drizzle-orm';
import { messageEvents, MessageEvent, NewMessageEvent } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>MessageEventRepository stores normalized engagement events from providers.</summary>
 * <summary>Enables analytics and state updates (opens, clicks, bounces, etc.).</summary>
 * <summary>Used to drive campaign transitions and feedback loops.</summary>
 */
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
