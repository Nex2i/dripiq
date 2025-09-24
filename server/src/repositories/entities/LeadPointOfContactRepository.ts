import { eq, and, isNotNull, sql, inArray } from 'drizzle-orm';
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
    // First get all contacts for the lead
    const contacts = await this.db
      .select()
      .from(leadPointOfContacts)
      .where(eq(leadPointOfContacts.leadId, leadId));

    if (contacts.length === 0) {
      return [];
    }

    // Get all email addresses from contacts (filter out null/empty emails)
    const emailAddresses = contacts
      .map(contact => contact.email)
      .filter((email): email is string => !!email)
      .map(email => email.toLowerCase().trim());

    // If no emails, return contacts with isUnsubscribed = false
    if (emailAddresses.length === 0) {
      return contacts.map(contact => ({
        ...contact,
        isUnsubscribed: false,
      }));
    }

    // Get unsubscribe records for these emails
    const unsubscribeRecords = await this.db
      .select({
        channelValue: contactUnsubscribes.channelValue,
      })
      .from(contactUnsubscribes)
      .where(
        and(
          eq(contactUnsubscribes.tenantId, tenantId),
          eq(contactUnsubscribes.channel, 'email'),
          inArray(contactUnsubscribes.channelValue, emailAddresses)
        )
      );

    // Create a Set of unsubscribed emails for quick lookup
    const unsubscribedEmails = new Set(
      unsubscribeRecords.map(record => record.channelValue)
    );

    // Map contacts with unsubscribe status
    return contacts.map(contact => ({
      ...contact,
      isUnsubscribed: contact.email ? unsubscribedEmails.has(contact.email.toLowerCase().trim()) : false,
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
