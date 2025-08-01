import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { leads, users, leadPointOfContacts, Lead, NewLead, User, LeadPointOfContact } from '@/db/schema';
import { BaseRepository, ITenantScopedRepository } from './base.repository';

export interface LeadWithOwner extends Lead {
  owner?: User;
  primaryContact?: LeadPointOfContact;
}

export interface LeadWithDetails extends Lead {
  owner?: User;
  pointOfContacts: LeadPointOfContact[];
}

export class LeadRepository extends BaseRepository implements ITenantScopedRepository<Lead, NewLead> {
  /**
   * Find lead by ID within tenant scope
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<Lead | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(leads)
        .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new lead within tenant scope
   */
  async create(leadData: NewLead, tenantId: string, userId?: string): Promise<Lead> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Ensure tenantId matches the data
      const dataWithTenant = { ...leadData, tenantId };

      const [lead] = await this.db.insert(leads).values(dataWithTenant).returning();
      if (!lead) {
        throw new Error('Failed to create lead');
      }
      return lead;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update lead within tenant scope
   */
  async update(id: string, updateData: Partial<NewLead>, tenantId: string, userId?: string): Promise<Lead> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [lead] = await this.db
        .update(leads)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
        .returning();

      if (!lead) {
        throw new Error('Lead not found or access denied');
      }
      return lead;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete lead within tenant scope
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<Lead> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [lead] = await this.db
        .delete(leads)
        .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
        .returning();

      if (!lead) {
        throw new Error('Lead not found or access denied');
      }
      return lead;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all leads for a tenant
   */
  async findByTenant(tenantId: string, userId?: string): Promise<Lead[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(leads)
        .where(eq(leads.tenantId, tenantId))
        .orderBy(desc(leads.createdAt));
    } catch (error) {
      this.handleError(error, 'findByTenant');
    }
  }

  /**
   * Find leads with search functionality
   */
  async findByTenantWithSearch(tenantId: string, searchQuery?: string, userId?: string): Promise<LeadWithOwner[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const baseWhere = eq(leads.tenantId, tenantId);

      if (searchQuery && searchQuery.trim()) {
        const searchTerm = `%${searchQuery.trim()}%`;
        
        const result = await this.db
          .select({
            // Lead fields
            id: leads.id,
            name: leads.name,
            url: leads.url,
            status: leads.status,
            summary: leads.summary,
            products: leads.products,
            services: leads.services,
            differentiators: leads.differentiators,
            targetMarket: leads.targetMarket,
            tone: leads.tone,
            brandColors: leads.brandColors,
            primaryContactId: leads.primaryContactId,
            ownerId: leads.ownerId,
            tenantId: leads.tenantId,
            siteEmbeddingDomainId: leads.siteEmbeddingDomainId,
            createdAt: leads.createdAt,
            updatedAt: leads.updatedAt,
            // Owner fields (nullable)
            ownerName: users.name,
            ownerEmail: users.email,
            ownerAvatar: users.avatar,
          })
          .from(leads)
          .leftJoin(users, eq(leads.ownerId, users.id))
          .leftJoin(leadPointOfContacts, eq(leads.id, leadPointOfContacts.leadId))
          .where(
            and(
              baseWhere,
              or(
                ilike(leads.name, searchTerm),
                ilike(leads.url, searchTerm),
                ilike(leads.summary, searchTerm),
                ilike(leadPointOfContacts.name, searchTerm),
                ilike(leadPointOfContacts.email, searchTerm),
                ilike(leadPointOfContacts.company, searchTerm),
                ilike(leadPointOfContacts.phone, searchTerm)
              )
            )
          )
          .orderBy(desc(leads.createdAt));

        // Group results and remove duplicates
        const uniqueLeads = new Map<string, LeadWithOwner>();
        for (const row of result) {
          if (!uniqueLeads.has(row.id)) {
            uniqueLeads.set(row.id, {
              id: row.id,
              name: row.name,
              url: row.url,
              status: row.status,
              summary: row.summary,
              products: row.products,
              services: row.services,
              differentiators: row.differentiators,
              targetMarket: row.targetMarket,
              tone: row.tone,
              brandColors: row.brandColors,
              primaryContactId: row.primaryContactId,
              ownerId: row.ownerId,
              tenantId: row.tenantId,
              siteEmbeddingDomainId: row.siteEmbeddingDomainId,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              owner: row.ownerName ? {
                id: row.ownerId!,
                name: row.ownerName,
                email: row.ownerEmail!,
                avatar: row.ownerAvatar,
                supabaseId: '', // Not needed for this query
                createdAt: new Date(),
                updatedAt: new Date(),
              } : undefined,
            });
          }
        }

        return Array.from(uniqueLeads.values());
      } else {
        // No search query, get all leads with owners
        const result = await this.db
          .select({
            // Lead fields
            id: leads.id,
            name: leads.name,
            url: leads.url,
            status: leads.status,
            summary: leads.summary,
            products: leads.products,
            services: leads.services,
            differentiators: leads.differentiators,
            targetMarket: leads.targetMarket,
            tone: leads.tone,
            brandColors: leads.brandColors,
            primaryContactId: leads.primaryContactId,
            ownerId: leads.ownerId,
            tenantId: leads.tenantId,
            siteEmbeddingDomainId: leads.siteEmbeddingDomainId,
            createdAt: leads.createdAt,
            updatedAt: leads.updatedAt,
            // Owner fields (nullable)
            ownerName: users.name,
            ownerEmail: users.email,
            ownerAvatar: users.avatar,
          })
          .from(leads)
          .leftJoin(users, eq(leads.ownerId, users.id))
          .where(baseWhere)
          .orderBy(desc(leads.createdAt));

        return result.map((row) => ({
          id: row.id,
          name: row.name,
          url: row.url,
          status: row.status,
          summary: row.summary,
          products: row.products,
          services: row.services,
          differentiators: row.differentiators,
          targetMarket: row.targetMarket,
          tone: row.tone,
          brandColors: row.brandColors,
          primaryContactId: row.primaryContactId,
          ownerId: row.ownerId,
          tenantId: row.tenantId,
          siteEmbeddingDomainId: row.siteEmbeddingDomainId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          owner: row.ownerName ? {
            id: row.ownerId!,
            name: row.ownerName,
            email: row.ownerEmail!,
            avatar: row.ownerAvatar,
            supabaseId: '', // Not needed for this query
            createdAt: new Date(),
            updatedAt: new Date(),
          } : undefined,
        }));
      }
    } catch (error) {
      this.handleError(error, 'findByTenantWithSearch');
    }
  }

  /**
   * Find lead by URL within tenant scope
   */
  async findByUrl(url: string, tenantId: string, userId?: string): Promise<Lead | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(leads)
        .where(and(eq(leads.url, url), eq(leads.tenantId, tenantId)))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findByUrl');
    }
  }

  /**
   * Find leads by owner within tenant scope
   */
  async findByOwner(ownerId: string, tenantId: string, userId?: string): Promise<Lead[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(leads)
        .where(and(eq(leads.ownerId, ownerId), eq(leads.tenantId, tenantId)))
        .orderBy(desc(leads.createdAt));
    } catch (error) {
      this.handleError(error, 'findByOwner');
    }
  }

  /**
   * Find leads by status within tenant scope
   */
  async findByStatus(status: string, tenantId: string, userId?: string): Promise<Lead[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(leads)
        .where(and(eq(leads.status, status), eq(leads.tenantId, tenantId)))
        .orderBy(desc(leads.createdAt));
    } catch (error) {
      this.handleError(error, 'findByStatus');
    }
  }

  /**
   * Update lead status
   */
  async updateStatus(id: string, status: string, tenantId: string, userId?: string): Promise<Lead> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [lead] = await this.db
        .update(leads)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
        .returning();

      if (!lead) {
        throw new Error('Lead not found or access denied');
      }
      return lead;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  /**
   * Update lead owner
   */
  async updateOwner(id: string, ownerId: string | null, tenantId: string, userId?: string): Promise<Lead> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [lead] = await this.db
        .update(leads)
        .set({
          ownerId,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
        .returning();

      if (!lead) {
        throw new Error('Lead not found or access denied');
      }
      return lead;
    } catch (error) {
      this.handleError(error, 'updateOwner');
    }
  }

  /**
   * Count leads by tenant
   */
  async countByTenant(tenantId: string, userId?: string): Promise<number> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select({ count: leads.id })
        .from(leads)
        .where(eq(leads.tenantId, tenantId));

      return result.length;
    } catch (error) {
      this.handleError(error, 'countByTenant');
    }
  }
}