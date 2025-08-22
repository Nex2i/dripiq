import { and, eq, desc, inArray } from 'drizzle-orm';
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

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewMessageEvent, 'tenantId'>
  ): Promise<MessageEvent> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as Omit<NewMessageEvent, 'tenantId'>), tenantId } as NewMessageEvent)
      .returning();
    return result as MessageEvent;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewMessageEvent, 'tenantId'>[]
  ): Promise<MessageEvent[]> {
    const values: NewMessageEvent[] = data.map(
      (d) => ({ ...(d as Omit<NewMessageEvent, 'tenantId'>), tenantId }) as NewMessageEvent
    );
    return (await this.db.insert(this.table).values(values).returning()) as MessageEvent[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<MessageEvent | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<MessageEvent[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as MessageEvent[];
  }

  async findAllForTenant(tenantId: string): Promise<MessageEvent[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as MessageEvent[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewMessageEvent, 'tenantId'>>
  ): Promise<MessageEvent | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as Partial<Omit<NewMessageEvent, 'tenantId'>> as Partial<NewMessageEvent>)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as MessageEvent | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<MessageEvent | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as MessageEvent | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<MessageEvent[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as MessageEvent[];
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

  async deleteAllForTenant(tenantId: string): Promise<MessageEvent[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as MessageEvent[];
  }

  // Domain helper
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

  /**
   * Find message event by SendGrid event ID for duplicate detection
   * @param tenantId - Tenant ID
   * @param sgEventId - SendGrid event ID
   * @returns MessageEvent if found, undefined otherwise
   */
  async findBySgEventIdForTenant(
    tenantId: string,
    sgEventId: string
  ): Promise<MessageEvent | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.sgEventId, sgEventId)))
      .limit(1);
    return results[0];
  }

  /**
   * Find a message event by messageId and event type for a tenant
   * Used by timeout worker to detect real engagement before emitting synthetic events
   */
  async findByMessageAndTypeForTenant(
    tenantId: string,
    messageId: string,
    eventType: string
  ): Promise<MessageEvent | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.messageId, messageId),
          eq(this.table.type, eventType)
        )
      )
      .limit(1);
    return results[0];
  }
}
