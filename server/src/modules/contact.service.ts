import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { leadPointOfContacts, leads, NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';
import { logger } from '@/libs/logger';

/**
 * Gets a contact by ID, ensuring it belongs to the specified tenant and lead.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead the contact belongs to.
 * @param contactId - The ID of the contact to retrieve.
 * @returns A promise that resolves to the contact if found, null otherwise.
 */
export const getContactById = async (
  tenantId: string,
  leadId: string,
  contactId: string
): Promise<LeadPointOfContact | null> => {
  try {
    // First verify the lead exists and belongs to the tenant
    const leadExists = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (leadExists.length === 0) {
      throw new Error(`Lead not found or does not belong to tenant: ${leadId}`);
    }

    // Get the contact
    const contacts = await db
      .select()
      .from(leadPointOfContacts)
      .where(and(eq(leadPointOfContacts.id, contactId), eq(leadPointOfContacts.leadId, leadId)))
      .limit(1);

    return contacts[0] || null;
  } catch (error) {
    logger.error('Error getting contact by ID:', error);
    throw error;
  }
};

/**
 * Updates a contact's information.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead the contact belongs to.
 * @param contactId - The ID of the contact to update.
 * @param contactData - The contact data to update.
 * @returns A promise that resolves to the updated contact.
 */
export const updateContact = async (
  tenantId: string,
  leadId: string,
  contactId: string,
  contactData: Partial<Pick<LeadPointOfContact, 'name' | 'email' | 'phone' | 'title'>>
): Promise<LeadPointOfContact> => {
  try {
    // Verify the contact exists and belongs to the tenant/lead
    const existingContact = await getContactById(tenantId, leadId, contactId);
    if (!existingContact) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Validate required fields
    if (contactData.name !== undefined && (!contactData.name || !contactData.name.trim())) {
      throw new Error('Contact name is required');
    }

    if (contactData.email !== undefined && (!contactData.email || !contactData.email.trim())) {
      throw new Error('Contact email is required');
    }

    // Basic email validation
    if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
      throw new Error('Invalid email format');
    }

    // Update the contact
    const [updatedContact] = await db
      .update(leadPointOfContacts)
      .set({
        ...contactData,
        updatedAt: new Date(),
      })
      .where(eq(leadPointOfContacts.id, contactId))
      .returning();

    if (!updatedContact) {
      throw new Error('Failed to update contact');
    }

    logger.info(`Updated contact ${contactId} for lead ${leadId}`);
    return updatedContact;
  } catch (error) {
    logger.error('Error updating contact:', error);
    throw error;
  }
};

/**
 * Creates a new contact for a specific lead.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead to create a contact for.
 * @param contactData - The contact data to create.
 * @returns A promise that resolves to the newly created contact.
 */
export const createContact = async (
  tenantId: string,
  leadId: string,
  contactData: Omit<NewLeadPointOfContact, 'leadId'>
): Promise<LeadPointOfContact> => {
  try {
    // First verify the lead exists and belongs to the tenant
    const leadExists = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (leadExists.length === 0) {
      throw new Error(`Lead not found or does not belong to tenant: ${leadId}`);
    }

    // Validate required fields
    if (!contactData.name || !contactData.name.trim()) {
      throw new Error('Contact name is required');
    }

    if (!contactData.email || !contactData.email.trim()) {
      throw new Error('Contact email is required');
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
      throw new Error('Invalid email format');
    }

    // Create the contact
    const newContact: NewLeadPointOfContact = {
      ...contactData,
      leadId,
    };

    const [createdContact] = await db.insert(leadPointOfContacts).values(newContact).returning();

    if (!createdContact) {
      throw new Error('Failed to create contact');
    }

    logger.info(`Created contact ${createdContact.name} for lead ${leadId}`);
    return createdContact;
  } catch (error) {
    logger.error('Error creating contact:', error);
    throw error;
  }
};

/**
 * Deletes a contact.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead the contact belongs to.
 * @param contactId - The ID of the contact to delete.
 * @returns A promise that resolves when the contact is deleted.
 */
export const deleteContact = async (
  tenantId: string,
  leadId: string,
  contactId: string
): Promise<void> => {
  try {
    // Verify the contact exists and belongs to the tenant/lead
    const existingContact = await getContactById(tenantId, leadId, contactId);
    if (!existingContact) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Delete the contact
    await db.delete(leadPointOfContacts).where(eq(leadPointOfContacts.id, contactId));

    logger.info(`Deleted contact ${contactId} for lead ${leadId}`);
  } catch (error) {
    logger.error('Error deleting contact:', error);
    throw error;
  }
};

/**
 * Toggles the manually reviewed status of a contact.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead the contact belongs to.
 * @param contactId - The ID of the contact to toggle.
 * @param manuallyReviewed - The new manually reviewed status.
 * @returns A promise that resolves to the updated contact.
 */
export const toggleContactManuallyReviewed = async (
  tenantId: string,
  leadId: string,
  contactId: string,
  manuallyReviewed: boolean
): Promise<LeadPointOfContact> => {
  try {
    // Verify the contact exists and belongs to the tenant/lead
    const existingContact = await getContactById(tenantId, leadId, contactId);
    if (!existingContact) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Update the contact's manually reviewed status
    const [updatedContact] = await db
      .update(leadPointOfContacts)
      .set({
        manuallyReviewed: manuallyReviewed,
        updatedAt: new Date(),
      })
      .where(eq(leadPointOfContacts.id, contactId))
      .returning();

    if (!updatedContact) {
      throw new Error('Failed to update contact manually reviewed status');
    }

    logger.info(`Updated contact ${contactId} manually reviewed status to ${manuallyReviewed}`);
    return updatedContact;
  } catch (error) {
    logger.error('Error toggling contact manually reviewed status:', error);
    throw error;
  }
};
