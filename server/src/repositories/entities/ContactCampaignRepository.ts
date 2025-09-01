import { and, eq, inArray } from 'drizzle-orm';
import { contactCampaigns, ContactCampaign, NewContactCampaign, channelEnum } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>ContactCampaignRepository orchestrates per-contact campaign instances and their lifecycle.</summary>
 * <summary>Supports idempotent lookup by contact+channel and status-based listings for execution control.</summary>
 * <summary>Acts as the central join point between plans, actions, messages, and state transitions.</summary>
 */
export class ContactCampaignRepository extends TenantAwareRepository<
  typeof contactCampaigns,
  ContactCampaign,
  NewContactCampaign
> {
  constructor() {
    super(contactCampaigns);
  }

  // Concrete tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewContactCampaign, 'tenantId'>
  ): Promise<ContactCampaign> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as Omit<NewContactCampaign, 'tenantId'>), tenantId } as NewContactCampaign)
      .returning();
    return result as ContactCampaign;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewContactCampaign, 'tenantId'>[]
  ): Promise<ContactCampaign[]> {
    const values: NewContactCampaign[] = data.map(
      (d) => ({ ...(d as Omit<NewContactCampaign, 'tenantId'>), tenantId }) as NewContactCampaign
    );
    return (await this.db.insert(this.table).values(values).returning()) as ContactCampaign[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<ContactCampaign | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<ContactCampaign[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as ContactCampaign[];
  }

  async findAllForTenant(tenantId: string): Promise<ContactCampaign[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as ContactCampaign[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewContactCampaign, 'tenantId'>>
  ): Promise<ContactCampaign | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as Partial<Omit<NewContactCampaign, 'tenantId'>> as Partial<NewContactCampaign>)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ContactCampaign | undefined;
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<ContactCampaign | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as ContactCampaign | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<ContactCampaign[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as ContactCampaign[];
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

  async deleteAllForTenant(tenantId: string): Promise<ContactCampaign[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as ContactCampaign[];
  }

  // Domain-specific methods
  async findByContactAndChannelForTenant(
    tenantId: string,
    contactId: string,
    channel: (typeof channelEnum)['enumValues'][number]
  ): Promise<ContactCampaign | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.contactId, contactId),
          eq(this.table.channel, channel)
        )
      )
      .limit(1);
    return results[0];
  }
}
