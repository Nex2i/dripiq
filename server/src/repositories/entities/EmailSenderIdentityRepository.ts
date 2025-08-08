import { eq, and, inArray } from 'drizzle-orm';
import { emailSenderIdentities, EmailSenderIdentity, NewEmailSenderIdentity } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>EmailSenderIdentityRepository manages AE sender identities used to send outbound emails.</summary>
 * <summary>Provides lookup for default identity and by from_email per tenant, enabling compliant sending.</summary>
 * <summary>Forms the foundation for channel-specific delivery configuration across campaigns.</summary>
 */
export class EmailSenderIdentityRepository extends TenantAwareRepository<
  typeof emailSenderIdentities,
  EmailSenderIdentity,
  NewEmailSenderIdentity
> {
  constructor() {
    super(emailSenderIdentities);
  }

  // Concrete CRUD (non-tenant-aware)
  async create(data: NewEmailSenderIdentity): Promise<EmailSenderIdentity> {
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result as EmailSenderIdentity;
  }

  async createMany(data: NewEmailSenderIdentity[]): Promise<EmailSenderIdentity[]> {
    return (await this.db.insert(this.table).values(data).returning()) as EmailSenderIdentity[];
  }

  async findById(id: string): Promise<EmailSenderIdentity> {
    const results = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!results[0]) throw new NotFoundError(`EmailSenderIdentity not found with id: ${id}`);
    return results[0];
  }

  async findByIds(ids: string[]): Promise<EmailSenderIdentity[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))) as EmailSenderIdentity[];
  }

  async findAll(): Promise<EmailSenderIdentity[]> {
    return (await this.db.select().from(this.table)) as EmailSenderIdentity[];
  }

  async updateById(
    id: string,
    data: Partial<NewEmailSenderIdentity>
  ): Promise<EmailSenderIdentity | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return result as EmailSenderIdentity | undefined;
  }

  async deleteById(id: string): Promise<EmailSenderIdentity | undefined> {
    const [result] = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result as EmailSenderIdentity | undefined;
  }

  async deleteByIds(ids: string[]): Promise<EmailSenderIdentity[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning()) as EmailSenderIdentity[];
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return !!result[0];
  }

  async count(): Promise<number> {
    const result = await this.db.select({ id: this.table.id }).from(this.table);
    return result.length;
  }

  // Concrete tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewEmailSenderIdentity, 'tenantId'>
  ): Promise<EmailSenderIdentity> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as EmailSenderIdentity;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewEmailSenderIdentity, 'tenantId'>[]
  ): Promise<EmailSenderIdentity[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as EmailSenderIdentity[];
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<EmailSenderIdentity | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<EmailSenderIdentity[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as EmailSenderIdentity[];
  }

  async findAllForTenant(tenantId: string): Promise<EmailSenderIdentity[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as EmailSenderIdentity[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewEmailSenderIdentity, 'tenantId'>>
  ): Promise<EmailSenderIdentity | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as EmailSenderIdentity | undefined;
  }

  async deleteByIdForTenant(
    id: string,
    tenantId: string
  ): Promise<EmailSenderIdentity | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as EmailSenderIdentity | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<EmailSenderIdentity[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as EmailSenderIdentity[];
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

  async deleteAllForTenant(tenantId: string): Promise<EmailSenderIdentity[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as EmailSenderIdentity[];
  }

  // Domain-specific methods
  async findDefaultForTenant(tenantId: string): Promise<EmailSenderIdentity | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.isDefault, true)))
      .limit(1);
    return results[0];
  }

  async findByFromEmailForTenant(
    tenantId: string,
    fromEmail: string
  ): Promise<EmailSenderIdentity | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.fromEmail, fromEmail)))
      .limit(1);
    return results[0];
  }
}
