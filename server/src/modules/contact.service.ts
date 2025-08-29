import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';
import { logger } from '@/libs/logger';
import { formatPhoneForStorage } from '@/libs/phoneFormatter';
import { leadPointOfContactRepository, leadRepository } from '@/repositories';
import { campaignPlanExecutionService } from '@/modules/campaign/campaignPlanExecution.service';
import { unsubscribeService } from '@/modules/unsubscribe';

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
): Promise<LeadPointOfContact> => {
  try {
    // First verify the lead exists and belongs to the tenant
    await leadRepository.findByIdForTenant(leadId, tenantId);

    // Get the contact
    const contact = await leadPointOfContactRepository.findById(contactId);

    return contact;
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

    // Format phone number if provided
    const formattedContactData = { ...contactData };
    if (contactData.phone !== undefined) {
      formattedContactData.phone = formatPhoneForStorage(contactData.phone);
    }

    // Update the contact
    const updatedContact = await leadPointOfContactRepository.updateById(
      contactId,
      formattedContactData
    );

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
    await leadRepository.findByIdForTenant(leadId, tenantId);

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

    // Format phone number if provided
    const formattedPhone = contactData.phone ? formatPhoneForStorage(contactData.phone) : null;

    // Create the contact
    const newContact: NewLeadPointOfContact = {
      ...contactData,
      phone: formattedPhone,
      leadId,
    };

    const createdContact = await leadPointOfContactRepository.create(newContact);

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
    await leadPointOfContactRepository.deleteById(contactId);

    logger.info(`Deleted contact ${contactId} for lead ${leadId}`);
  } catch (error) {
    logger.error('Error deleting contact:', error);
    throw error;
  }
};

/**
 * Toggles the manually reviewed status of a contact.
 * If the contact is being marked as manually reviewed and has an associated campaign,
 * it will initialize campaign execution and publish a queue message.
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

    // Update the contact's manually reviewed status first
    const updatedContact = await leadPointOfContactRepository.updateById(contactId, {
      manuallyReviewed,
    });

    if (!updatedContact) {
      throw new Error('Failed to update contact manually reviewed status');
    }

    // If contact is being marked as manually reviewed, trigger campaign execution
    if (manuallyReviewed) {
      try {
        await campaignPlanExecutionService.handleManuallyReviewedExecution(
          tenantId,
          contactId,
          leadId
        );
      } catch (campaignError) {
        // Log the error but don't fail the manually reviewed status update
        logger.error('Failed to initialize campaign execution for manually reviewed contact', {
          tenantId,
          leadId,
          contactId,
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error',
        });
        // Continue execution - the manually reviewed status was still updated successfully
      }
    }

    logger.info(`Updated contact ${contactId} manually reviewed status to ${manuallyReviewed}`);
    return updatedContact;
  } catch (error) {
    logger.error('Error toggling contact manually reviewed status:', error);
    throw error;
  }
};

/**
 * Updates the strategy status of a contact.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead the contact belongs to.
 * @param contactId - The ID of the contact to update.
 * @param strategyStatus - The new strategy status ('none' | 'generating' | 'completed' | 'failed').
 * @returns A promise that resolves to the updated contact.
 */
export const updateContactStrategyStatus = async (
  tenantId: string,
  leadId: string,
  contactId: string,
  strategyStatus: 'none' | 'generating' | 'completed' | 'failed'
): Promise<LeadPointOfContact> => {
  try {
    // Verify the contact exists and belongs to the tenant/lead
    const existingContact = await getContactById(tenantId, leadId, contactId);
    if (!existingContact) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Update the contact's strategy status
    const updatedContact = await leadPointOfContactRepository.updateById(contactId, {
      strategyStatus,
    });

    if (!updatedContact) {
      throw new Error('Failed to update contact strategy status');
    }

    logger.info(`Updated contact ${contactId} strategy status to ${strategyStatus}`);
    return updatedContact;
  } catch (error) {
    logger.error('Error updating contact strategy status:', error);
    throw error;
  }
};

/**
 * Unsubscribes a contact from email communications.
 * @param tenantId - The ID of the tenant.
 * @param leadId - The ID of the lead the contact belongs to.
 * @param contactId - The ID of the contact to unsubscribe.
 * @returns A promise that resolves to a success indicator.
 */
export const unsubscribeContact = async (
  tenantId: string,
  leadId: string,
  contactId: string
): Promise<boolean> => {
  try {
    // Verify the contact exists and belongs to the tenant/lead
    const existingContact = await getContactById(tenantId, leadId, contactId);
    if (!existingContact) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Validate that the contact has an email
    if (!existingContact.email) {
      throw new Error('Contact must have an email address to unsubscribe');
    }

    // Unsubscribe the contact using the unsubscribe service
    await unsubscribeService.unsubscribeByChannel(
      tenantId,
      'email',
      existingContact.email,
      'manual_admin',
      {
        contactId: contactId,
      }
    );

    logger.info(`Unsubscribed contact ${contactId} (${existingContact.email}) for lead ${leadId}`);
    return true;
  } catch (error) {
    logger.error('Error unsubscribing contact:', error);
    throw error;
  }
};
