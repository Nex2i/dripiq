import { eq, and, isNotNull } from 'drizzle-orm';
import { leadPointOfContacts, LeadPointOfContact, NewLeadPointOfContact, leads, contactUnsubscribes } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { BaseRepository } from '../base/BaseRepository';

export class LeadPointOfContactRepository extends BaseRepository<
  typeof leadPointOfContacts,
  LeadPointOfContact,
  NewLeadPointOfContact
> {
  constructor() {
    super(leadPointOfContacts);
  }

  /**
   * Find contacts by lead ID with tenant validation
   */
  async findByLeadId(leadId: string): Promise<LeadPointOfContact[]> {
    return await this.db
      .select()
      .from(leadPointOfContacts)
      .where(eq(leadPointOfContacts.leadId, leadId));
  }

  /**
   * Find contacts by lead ID with unsubscribe status included
   * Uses a single optimized query with LEFT JOIN to get unsubscribe status
   */
  async findByLeadIdWithUnsubscribeStatus(
    leadId: string, 
    tenantId: string
  ): Promise<(LeadPointOfContact & { isUnsubscribed: boolean })[]> {
    const results = await this.db
      .select({
        // Select all contact fields
        id: leadPointOfContacts.id,
        leadId: leadPointOfContacts.leadId,
        name: leadPointOfContacts.name,
        email: leadPointOfContacts.email,
        phone: leadPointOfContacts.phone,
        title: leadPointOfContacts.title,
        company: leadPointOfContacts.company,
        sourceUrl: leadPointOfContacts.sourceUrl,
        manuallyReviewed: leadPointOfContacts.manuallyReviewed,
        strategyStatus: leadPointOfContacts.strategyStatus,
        createdAt: leadPointOfContacts.createdAt,
        updatedAt: leadPointOfContacts.updatedAt,
        // Check if unsubscribe record exists
        unsubscribeId: contactUnsubscribes.id,
      })
      .from(leadPointOfContacts)
      .leftJoin(
        contactUnsubscribes,
        and(
          eq(contactUnsubscribes.tenantId, tenantId),
          eq(contactUnsubscribes.channel, 'email'),
          eq(contactUnsubscribes.channelValue, leadPointOfContacts.email),
          isNotNull(leadPointOfContacts.email) // Only join if email is not null
        )
      )
      .where(eq(leadPointOfContacts.leadId, leadId));

    // Transform the results to include isUnsubscribed boolean
    return results.map(result => ({
      id: result.id,
      leadId: result.leadId,
      name: result.name,
      email: result.email,
      phone: result.phone,
      title: result.title,
      company: result.company,
      sourceUrl: result.sourceUrl,
      manuallyReviewed: result.manuallyReviewed,
      strategyStatus: result.strategyStatus,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      isUnsubscribed: !!result.unsubscribeId,
    }));
  }

  /**
   * Find contact by ID with tenant validation (through lead)
   * @param id - The ID of the contact to find.
   * @param tenantId - The ID of the tenant to find the contact for.
   * @returns The contact if found, otherwise undefined.
   */
  async findByIdForTenant(id: string, tenantId: string): Promise<LeadPointOfContact> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .where(and(eq(this.table.id, id), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!results[0]) {
      throw new NotFoundError(`Contact not found with id ${id} for tenant ${tenantId}`);
    }

    return results[0].lead_point_of_contacts;
  }

  /**
   * Create contact for lead with tenant validation
   */
  async createForLeadAndTenant(
    leadId: string,
    tenantId: string,
    data: Omit<NewLeadPointOfContact, 'leadId'>
  ): Promise<LeadPointOfContact> {
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
}
