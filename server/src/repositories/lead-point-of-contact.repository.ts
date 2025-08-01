import { eq, and } from 'drizzle-orm';
import { leadPointOfContacts, leads, LeadPointOfContact, NewLeadPointOfContact } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export class LeadPointOfContactRepository extends BaseRepository implements IRepository<LeadPointOfContact, NewLeadPointOfContact> {
  /**
   * Find lead point of contact by ID within tenant scope
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<LeadPointOfContact | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the contact belongs to a lead in the tenant
      const result = await this.db
        .select({ contact: leadPointOfContacts })
        .from(leadPointOfContacts)
        .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
        .where(and(eq(leadPointOfContacts.id, id), eq(leads.tenantId, tenantId)))
        .limit(1);

      return result[0]?.contact || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new lead point of contact
   */
  async create(contactData: NewLeadPointOfContact, tenantId: string, userId?: string): Promise<LeadPointOfContact> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead belongs to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, contactData.leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      const [contact] = await this.db.insert(leadPointOfContacts).values(contactData).returning();
      if (!contact) {
        throw new Error('Failed to create contact');
      }
      return contact;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update lead point of contact
   */
  async update(id: string, updateData: Partial<NewLeadPointOfContact>, tenantId: string, userId?: string): Promise<LeadPointOfContact> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Update contact and verify it belongs to a lead in the tenant
      const [contact] = await this.db
        .update(leadPointOfContacts)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .from(leads)
        .where(and(
          eq(leadPointOfContacts.id, id),
          eq(leadPointOfContacts.leadId, leads.id),
          eq(leads.tenantId, tenantId)
        ))
        .returning({ contact: leadPointOfContacts });

      if (!contact) {
        throw new Error('Contact not found or access denied');
      }
      return contact.contact;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete lead point of contact
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<LeadPointOfContact> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // First verify the contact belongs to a lead in the tenant
      const contactExists = await this.db
        .select({ contact: leadPointOfContacts })
        .from(leadPointOfContacts)
        .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
        .where(and(eq(leadPointOfContacts.id, id), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (!contactExists[0]) {
        throw new Error('Contact not found or access denied');
      }

      const [contact] = await this.db
        .delete(leadPointOfContacts)
        .where(eq(leadPointOfContacts.id, id))
        .returning();

      if (!contact) {
        throw new Error('Failed to delete contact');
      }
      return contact;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all contacts for a lead
   */
  async findByLead(leadId: string, tenantId: string, userId?: string): Promise<LeadPointOfContact[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead belongs to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      return await this.db
        .select()
        .from(leadPointOfContacts)
        .where(eq(leadPointOfContacts.leadId, leadId))
        .orderBy(leadPointOfContacts.createdAt);
    } catch (error) {
      this.handleError(error, 'findByLead');
    }
  }

  /**
   * Find contact by email within a lead
   */
  async findByEmailInLead(email: string, leadId: string, tenantId: string, userId?: string): Promise<LeadPointOfContact | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead belongs to the tenant and find contact
      const result = await this.db
        .select({ contact: leadPointOfContacts })
        .from(leadPointOfContacts)
        .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
        .where(and(
          eq(leadPointOfContacts.email, email),
          eq(leadPointOfContacts.leadId, leadId),
          eq(leads.tenantId, tenantId)
        ))
        .limit(1);

      return result[0]?.contact || null;
    } catch (error) {
      this.handleError(error, 'findByEmailInLead');
    }
  }

  /**
   * Update manually reviewed status
   */
  async updateManuallyReviewed(id: string, manuallyReviewed: boolean, tenantId: string, userId?: string): Promise<LeadPointOfContact> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.update(id, { manuallyReviewed }, tenantId, userId);
    } catch (error) {
      this.handleError(error, 'updateManuallyReviewed');
    }
  }

  /**
   * Find contacts that need manual review for a tenant
   */
  async findUnreviewedByTenant(tenantId: string, userId?: string): Promise<LeadPointOfContact[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select({ contact: leadPointOfContacts })
        .from(leadPointOfContacts)
        .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leadPointOfContacts.manuallyReviewed, false)
        ))
        .orderBy(leadPointOfContacts.createdAt);

      return result.map(row => row.contact);
    } catch (error) {
      this.handleError(error, 'findUnreviewedByTenant');
    }
  }
}