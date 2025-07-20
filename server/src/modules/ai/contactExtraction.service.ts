import { logger } from '@/libs/logger';
import { NewLeadPointOfContact } from '@/db/schema';
import { createContact } from '../lead.service';
import { contactExtractionAgent } from './langchain';
import { ExtractedContact } from './schemas/contactExtractionSchema';

export const ContactExtractionService = {
  /**
   * Extract contacts from a domain and save them to a lead
   */
  extractAndSaveContacts: async (tenantId: string, leadId: string, domain: string) => {
    try {
      logger.info(`Starting contact extraction for domain: ${domain}, leadId: ${leadId}`);

      // Extract contacts using the agent
      const extractionResult = await contactExtractionAgent.extractContacts(domain);

      if (!extractionResult.finalResponseParsed?.contacts) {
        logger.warn(`No contacts found for domain: ${domain}`);
        return {
          contactsCreated: 0,
          summary: extractionResult.finalResponseParsed?.summary || 'No contacts found',
          extractionResult,
        };
      }

      const contacts = extractionResult.finalResponseParsed.contacts;
      logger.info(`Found ${contacts.length} contacts for domain: ${domain}`);

      // Process and save contacts
      const createdContacts = await ContactExtractionService.processAndSaveContacts(
        tenantId,
        leadId,
        contacts
      );

      logger.info(`Successfully created ${createdContacts.length} contacts for leadId: ${leadId}`);

      return {
        contactsCreated: createdContacts.length,
        summary: extractionResult.finalResponseParsed.summary,
        extractionResult,
        contacts: createdContacts,
      };
    } catch (error) {
      logger.error('Contact extraction failed:', error);
      throw new Error(
        `Contact extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  /**
   * Process extracted contacts and save them to the database
   */
  processAndSaveContacts: async (
    tenantId: string,
    leadId: string,
    extractedContacts: ExtractedContact[]
  ) => {
    const createdContacts = [];

    for (const contact of extractedContacts) {
      try {
        const leadContact = ContactExtractionService.transformToLeadContact(contact);

        // Create the contact
        const createdContact = await createContact(tenantId, leadId, leadContact);
        createdContacts.push(createdContact);

        logger.debug(`Created contact: ${contact.name} for leadId: ${leadId}`);
      } catch (error) {
        logger.warn(`Failed to create contact ${contact.name} for leadId: ${leadId}:`, error);
        // Continue processing other contacts even if one fails
      }
    }

    return createdContacts;
  },

  /**
   * Transform extracted contact to lead point of contact format
   */
  transformToLeadContact: (
    extractedContact: ExtractedContact
  ): Omit<NewLeadPointOfContact, 'leadId'> => {
    // Determine the name based on contact type
    let name = extractedContact.name;
    if (
      extractedContact.contactType === 'office' ||
      extractedContact.contactType === 'department'
    ) {
      // For offices/departments, ensure the name is descriptive
      if (
        !name.toLowerCase().includes('office') &&
        !name.toLowerCase().includes('department') &&
        !name.toLowerCase().includes('team') &&
        !name.toLowerCase().includes('support') &&
        !name.toLowerCase().includes('sales')
      ) {
        const suffix = extractedContact.contactType === 'office' ? ' Office' : ' Department';
        name = `${name}${suffix}`;
      }
    }

    // Handle company name - use null if it's the same as the main company or not provided
    let company = extractedContact.company;
    if (!company || company.trim() === '') {
      company = null;
    }

    // Combine title and context for more complete information
    let title = extractedContact.title;
    if (extractedContact.context && extractedContact.context !== title) {
      if (title) {
        title = `${title} (${extractedContact.context})`;
      } else {
        title = extractedContact.context;
      }
    }

    return {
      name,
      email: extractedContact.email || null,
      phone: extractedContact.phone || null,
      title: title || null,
      company,
    };
  },

  /**
   * Validate extracted contact data
   */
  validateContact: (contact: ExtractedContact): boolean => {
    // Must have at least a name
    if (!contact.name || contact.name.trim() === '') {
      return false;
    }

    // Must have at least one form of contact information or be a named individual
    const hasContactInfo = !!(
      contact.email ||
      contact.phone ||
      contact.address ||
      contact.linkedinUrl ||
      contact.websiteUrl
    );

    const isNamedIndividual =
      contact.contactType === 'individual' && contact.name.split(' ').length >= 2; // Has first and last name

    return hasContactInfo || isNamedIndividual;
  },
};
