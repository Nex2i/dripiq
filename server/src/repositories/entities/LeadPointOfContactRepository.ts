import { eq, and } from 'drizzle-orm';
import { BaseRepository } from '../base/BaseRepository';
import { leadPointOfContacts, LeadPointOfContact, NewLeadPointOfContact, leads } from '@/db/schema';

export class LeadPointOfContactRepository extends BaseRepository<typeof leadPointOfContacts, LeadPointOfContact, NewLeadPointOfContact> {
  constructor() {
    super(leadPointOfContacts);
  }

  /**
   * Find contacts by lead ID with tenant validation
   */
  async findByLeadIdForTenant(leadId: string, tenantId: string): Promise<LeadPointOfContact[]> {
    return await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .where(and(eq(this.table.leadId, leadId), eq(leads.tenantId, tenantId))) as any;
  }

  /**
   * Find contact by ID with tenant validation (through lead)
   */
  async findByIdForTenant(id: string, tenantId: string): Promise<LeadPointOfContact | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .where(and(eq(this.table.id, id), eq(leads.tenantId, tenantId)))
      .limit(1);
    return results[0]?.lead_point_of_contacts;
  }

  /**
   * Create contact for lead with tenant validation
   */
  async createForLeadAndTenant(leadId: string, tenantId: string, data: Omit<NewLeadPointOfContact, 'leadId'>): Promise<LeadPointOfContact> {
    // First verify the lead belongs to the tenant
    const lead = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead[0]) {
      throw new Error('Lead not found or does not belong to tenant');
    }

    const contactData: NewLeadPointOfContact = {
      ...data,
      leadId,
    };

    return await this.create(contactData);
  }

  /**
   * Update contact with tenant validation
   */
  async updateByIdForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewLeadPointOfContact, 'leadId'>>
  ): Promise<LeadPointOfContact | undefined> {
    // First verify the contact belongs to a lead in the tenant
    const contact = await this.findByIdForTenant(id, tenantId);
    if (!contact) {
      return undefined;
    }

    const [result] = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    return result;
  }

  /**
   * Delete contact with tenant validation
   */
  async deleteByIdForTenant(id: string, tenantId: string): Promise<LeadPointOfContact | undefined> {
    // First verify the contact belongs to a lead in the tenant
    const contact = await this.findByIdForTenant(id, tenantId);
    if (!contact) {
      return undefined;
    }

    const [result] = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning();
    return result;
  }

  /**
   * Find contacts by email
   */
  async findByEmailForTenant(email: string, tenantId: string): Promise<LeadPointOfContact[]> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .where(and(eq(this.table.email, email), eq(leads.tenantId, tenantId)));
    return results.map(result => result.lead_point_of_contacts);
  }

  /**
   * Find manually reviewed contacts for tenant
   */
  async findManuallyReviewedForTenant(tenantId: string): Promise<LeadPointOfContact[]> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .where(and(eq(this.table.manuallyReviewed, true), eq(leads.tenantId, tenantId)));
    return results.map(result => result.lead_point_of_contacts);
  }

  /**
   * Mark contact as manually reviewed
   */
  async markAsManuallyReviewedForTenant(id: string, tenantId: string): Promise<LeadPointOfContact | undefined> {
    return await this.updateByIdForTenant(id, tenantId, { manuallyReviewed: true });
  }

  /**
   * Delete all contacts for a lead
   */
  async deleteAllForLead(leadId: string): Promise<LeadPointOfContact[]> {
    return await this.db
      .delete(this.table)
              .where(eq(this.table.leadId, leadId))
        .returning();
    }
}