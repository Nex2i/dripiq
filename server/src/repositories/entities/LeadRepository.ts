import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { leads, Lead, NewLead, users, User } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface LeadWithOwner extends Lead {
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface LeadSearchOptions {
  searchQuery?: string;
  ownerId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class LeadRepository extends TenantAwareRepository<typeof leads, Lead, NewLead> {
  constructor() {
    super(leads);
  }

  /**
   * Find lead by id
   */
  async findById(id: string): Promise<LeadWithOwner> {
    const lead = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);

    if (!lead || !lead[0]) {
      throw new NotFoundError(`Lead not found with id: ${id}`);
    }

    return lead[0];
  }

  /**
   * Get a user from lead owner
   * @param leadId
   * @param tenantId
   * @returns User
   */
  async findOwnerForLead(leadId: string, tenantId: string): Promise<User> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, leadId), eq(this.table.tenantId, tenantId)))
      .innerJoin(users, eq(this.table.ownerId, users.id))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`Lead not found with id: ${leadId} for tenant: ${tenantId}`);
    }

    return result[0].users;
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<LeadWithOwner> {
    const lead = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.tenantId, tenantId)))
      .limit(1);

    if (!lead || !lead[0]) {
      throw new NotFoundError(`Lead not found with id: ${id} for tenant: ${tenantId}`);
    }

    return lead[0];
  }

  /**
   * Find leads with search functionality
   */
  async findWithSearch(
    tenantId: string,
    options: LeadSearchOptions = {}
  ): Promise<LeadWithOwner[]> {
    const { searchQuery, ownerId, status, limit, offset } = options;

    let query = this.db
      .select({
        // Lead fields
        id: this.table.id,
        name: this.table.name,
        url: this.table.url,
        status: this.table.status,
        summary: this.table.summary,
        products: this.table.products,
        services: this.table.services,
        differentiators: this.table.differentiators,
        targetMarket: this.table.targetMarket,
        tone: this.table.tone,
        brandColors: this.table.brandColors,
        primaryContactId: this.table.primaryContactId,
        ownerId: this.table.ownerId,
        tenantId: this.table.tenantId,
        siteEmbeddingDomainId: this.table.siteEmbeddingDomainId,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
        // Owner fields
        owner: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(this.table)
      .leftJoin(users, eq(this.table.ownerId, users.id));

    // Build where conditions
    const conditions = [eq(this.table.tenantId, tenantId)];

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = `%${searchQuery.trim()}%`;
      conditions.push(or(ilike(this.table.name, searchTerm), ilike(this.table.url, searchTerm))!);
    }

    if (ownerId) {
      conditions.push(eq(this.table.ownerId, ownerId));
    }

    if (status) {
      conditions.push(eq(this.table.status, status));
    }

    (query as any) = (query as any).where(and(...conditions)).orderBy(desc(this.table.createdAt));

    if (limit) {
      (query as any) = (query as any).limit(limit);
    }

    if (offset) {
      (query as any) = (query as any).offset(offset);
    }

    return await (query as any);
  }

  /**
   * Find lead by URL within tenant
   */
  async findByUrlForTenant(url: string, tenantId: string): Promise<Lead | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.url, url), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  /**
   * Find leads by owner
   */
  async findByOwnerForTenant(ownerId: string, tenantId: string): Promise<Lead[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.ownerId, ownerId), eq(this.table.tenantId, tenantId)));
  }

  /**
   * Find leads by status
   */
  async findByStatusForTenant(status: string, tenantId: string): Promise<Lead[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.status, status), eq(this.table.tenantId, tenantId)));
  }

  /**
   * Update lead status
   */
  async updateStatusForTenant(
    id: string,
    tenantId: string,
    status: string
  ): Promise<Lead | undefined> {
    return await this.updateByIdForTenant(id, tenantId, { status });
  }

  /**
   * Assign lead to owner
   */
  async assignToOwnerForTenant(
    id: string,
    tenantId: string,
    ownerId: string | null
  ): Promise<Lead | undefined> {
    return await this.updateByIdForTenant(id, tenantId, { ownerId });
  }

  /**
   * Set primary contact for lead
   */
  async setPrimaryContactForTenant(
    id: string,
    tenantId: string,
    primaryContactId: string | null
  ): Promise<Lead | undefined> {
    return await this.updateByIdForTenant(id, tenantId, { primaryContactId });
  }

  /**
   * Update lead details
   */
  async updateDetailsForTenant(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      summary?: string;
      products?: any[];
      services?: any[];
      differentiators?: any[];
      targetMarket?: string;
      tone?: string;
      brandColors?: any[];
    }
  ): Promise<Lead | undefined> {
    return await this.updateByIdForTenant(id, tenantId, data);
  }

  /**
   * Set site embedding domain for lead
   */
  async setSiteEmbeddingDomainForTenant(
    id: string,
    tenantId: string,
    siteEmbeddingDomainId: string | null
  ): Promise<Lead | undefined> {
    return await this.updateByIdForTenant(id, tenantId, { siteEmbeddingDomainId });
  }

  /**
   * Find leads with site embedding domain
   */
  async findWithSiteEmbeddingDomainForTenant(
    siteEmbeddingDomainId: string,
    tenantId: string
  ): Promise<Lead[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.siteEmbeddingDomainId, siteEmbeddingDomainId),
          eq(this.table.tenantId, tenantId)
        )
      );
  }
}
