import { and, eq, desc, inArray } from 'drizzle-orm';
import {
  emailValidationResults,
  EmailValidationResult,
  NewEmailValidationResult,
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>EmailValidationResultRepository caches SendGrid (or provider) validation results.</summary>
 * <summary>Reduces repeated verification calls and accelerates list hygiene decisions.</summary>
 * <summary>Consulted during channel selection and preflight checks before sending.</summary>
 */
export class EmailValidationResultRepository extends TenantAwareRepository<
  typeof emailValidationResults,
  EmailValidationResult,
  NewEmailValidationResult
> {
  constructor() {
    super(emailValidationResults);
  }

  // Concrete CRUD
  async create(data: NewEmailValidationResult): Promise<EmailValidationResult> {
    const [result] = await this.db.insert(this.table).values(data).returning();
    return result as EmailValidationResult;
  }

  async createMany(data: NewEmailValidationResult[]): Promise<EmailValidationResult[]> {
    return (await this.db.insert(this.table).values(data).returning()) as EmailValidationResult[];
  }

  async findById(id: string): Promise<EmailValidationResult> {
    const results = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!results[0]) throw new NotFoundError(`EmailValidationResult not found with id: ${id}`);
    return results[0];
  }

  async findByIds(ids: string[]): Promise<EmailValidationResult[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))) as EmailValidationResult[];
  }

  async findAll(): Promise<EmailValidationResult[]> {
    return (await this.db.select().from(this.table)) as EmailValidationResult[];
  }

  async updateById(
    id: string,
    data: Partial<NewEmailValidationResult>
  ): Promise<EmailValidationResult | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning();
    return result as EmailValidationResult | undefined;
  }

  async deleteById(id: string): Promise<EmailValidationResult | undefined> {
    const [result] = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result as EmailValidationResult | undefined;
  }

  async deleteByIds(ids: string[]): Promise<EmailValidationResult[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids))
      .returning()) as EmailValidationResult[];
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

  // Tenant-aware CRUD
  async createForTenant(
    tenantId: string,
    data: Omit<NewEmailValidationResult, 'tenantId'>
  ): Promise<EmailValidationResult> {
    const [result] = await this.db
      .insert(this.table)
      .values({ ...(data as any), tenantId })
      .returning();
    return result as EmailValidationResult;
  }

  async createManyForTenant(
    tenantId: string,
    data: Omit<NewEmailValidationResult, 'tenantId'>[]
  ): Promise<EmailValidationResult[]> {
    const values = data.map((d) => ({ ...(d as any), tenantId }));
    return (await this.db.insert(this.table).values(values).returning()) as EmailValidationResult[];
  }

  async findByIdForTenant(
    id: string,
    tenantId: string
  ): Promise<EmailValidationResult | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findByIdsForTenant(ids: string[], tenantId: string): Promise<EmailValidationResult[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId))
      )) as EmailValidationResult[];
  }

  async findAllForTenant(tenantId: string): Promise<EmailValidationResult[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))) as EmailValidationResult[];
  }

  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewEmailValidationResult, 'tenantId'>>
  ): Promise<EmailValidationResult | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data as any)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as EmailValidationResult | undefined;
  }

  async deleteByIdForTenant(
    id: string,
    tenantId: string
  ): Promise<EmailValidationResult | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .returning();
    return result as EmailValidationResult | undefined;
  }

  async deleteByIdsForTenant(ids: string[], tenantId: string): Promise<EmailValidationResult[]> {
    if (ids.length === 0) return [];
    return (await this.db
      .delete(this.table)
      .where(and(inArray(this.table.id, ids), eq(this.table.tenantId, tenantId)))
      .returning()) as EmailValidationResult[];
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

  async deleteAllForTenant(tenantId: string): Promise<EmailValidationResult[]> {
    return (await this.db
      .delete(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .returning()) as EmailValidationResult[];
  }

  // Domain helper
  async findByEmailForTenant(
    tenantId: string,
    email: string
  ): Promise<EmailValidationResult | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.email, email)))
      .orderBy(desc(this.table.checkedAt))
      .limit(1);
    return results[0];
  }
}
