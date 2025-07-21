import { compareTwoStrings } from 'string-similarity';
import { eq } from 'drizzle-orm';
import { logger } from '@/libs/logger';
import { NewLeadPointOfContact, LeadPointOfContact, leadPointOfContacts } from '@/db/schema';
import db from '@/libs/drizzleClient';
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

      // Get existing contacts for the lead
      const existingContacts = await ContactExtractionService.getExistingContacts(leadId);

      // Process and save contacts with merging
      const processedContacts = await ContactExtractionService.processAndMergeContacts(
        tenantId,
        leadId,
        contacts,
        existingContacts
      );

      logger.info(
        `Successfully processed ${processedContacts.created} new and ${processedContacts.updated} updated contacts for leadId: ${leadId}`
      );

      return {
        contactsCreated: processedContacts.created,
        contactsUpdated: processedContacts.updated,
        summary: extractionResult.finalResponseParsed.summary,
        extractionResult,
        contacts: processedContacts.contacts,
      };
    } catch (error) {
      logger.error('Contact extraction failed:', error);
      throw new Error(
        `Contact extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  /**
   * Get existing contacts for a lead
   */
  getExistingContacts: async (leadId: string): Promise<LeadPointOfContact[]> => {
    try {
      const contacts = await db
        .select()
        .from(leadPointOfContacts)
        .where(eq(leadPointOfContacts.leadId, leadId));

      return contacts;
    } catch (error) {
      logger.error('Error getting existing contacts:', error);
      return [];
    }
  },

  /**
   * Process extracted contacts and merge with existing ones
   */
  processAndMergeContacts: async (
    tenantId: string,
    leadId: string,
    extractedContacts: ExtractedContact[],
    existingContacts: LeadPointOfContact[]
  ) => {
    const results = {
      created: 0,
      updated: 0,
      contacts: [] as LeadPointOfContact[],
    };

    for (const extractedContact of extractedContacts) {
      try {
        const leadContact = ContactExtractionService.transformToLeadContact(extractedContact);

        // Find similar existing contact
        const similarContact = ContactExtractionService.findSimilarContact(
          leadContact,
          existingContacts
        );

        if (similarContact) {
          // Merge and update existing contact
          const mergedContact = ContactExtractionService.mergeContacts(similarContact, leadContact);

          const updatedContact = await ContactExtractionService.updateContact(
            similarContact.id,
            mergedContact
          );

          if (updatedContact) {
            results.updated++;
            results.contacts.push(updatedContact);
            logger.debug(`Updated contact: ${extractedContact.name} for leadId: ${leadId}`);
          }
        } else {
          // Create new contact
          const createdContact = await createContact(tenantId, leadId, leadContact);
          results.created++;
          results.contacts.push(createdContact);
          logger.debug(`Created contact: ${extractedContact.name} for leadId: ${leadId}`);
        }
      } catch (error) {
        logger.warn(
          `Failed to process contact ${extractedContact.name} for leadId: ${leadId}:`,
          error
        );
        // Continue processing other contacts even if one fails
      }
    }

    return results;
  },

  /**
   * Find similar contact using string similarity
   */
  findSimilarContact: (
    newContact: Omit<NewLeadPointOfContact, 'leadId'>,
    existingContacts: LeadPointOfContact[],
    threshold: number = 0.75
  ): LeadPointOfContact | null => {
    let bestMatch: LeadPointOfContact | null = null;
    let bestScore = 0;

    for (const existing of existingContacts) {
      const score = ContactExtractionService.calculateContactSimilarity(newContact, existing);

      if (score > threshold && score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
    }

    return bestMatch;
  },

  /**
   * Calculate similarity score between two contacts
   */
  calculateContactSimilarity: (
    contact1: Omit<NewLeadPointOfContact, 'leadId'>,
    contact2: LeadPointOfContact
  ): number => {
    const weights = {
      name: 0.4,
      email: 0.3,
      phone: 0.2,
      company: 0.1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Name similarity (most important)
    if (contact1.name && contact2.name) {
      const nameScore = compareTwoStrings(
        contact1.name.toLowerCase().trim(),
        contact2.name.toLowerCase().trim()
      );
      totalScore += nameScore * weights.name;
      totalWeight += weights.name;
    }

    // Email similarity
    if (contact1.email && contact2.email) {
      const emailScore = compareTwoStrings(
        contact1.email.toLowerCase().trim(),
        contact2.email.toLowerCase().trim()
      );
      totalScore += emailScore * weights.email;
      totalWeight += weights.email;
    }

    // Phone similarity (normalize phone numbers)
    if (contact1.phone && contact2.phone) {
      const phone1 = ContactExtractionService.normalizePhone(contact1.phone);
      const phone2 = ContactExtractionService.normalizePhone(contact2.phone);

      if (phone1 === phone2) {
        totalScore += 1.0 * weights.phone;
      } else {
        const phoneScore = compareTwoStrings(phone1, phone2);
        totalScore += phoneScore * weights.phone;
      }
      totalWeight += weights.phone;
    }

    // Company similarity
    if (contact1.company && contact2.company) {
      const companyScore = compareTwoStrings(
        contact1.company.toLowerCase().trim(),
        contact2.company.toLowerCase().trim()
      );
      totalScore += companyScore * weights.company;
      totalWeight += weights.company;
    }

    // Return weighted average
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  },

  /**
   * Normalize phone number for comparison
   */
  normalizePhone: (phone: string): string => {
    return phone.replace(/[\s\-()[\]+]/g, '').replace(/^1/, '');
  },

  /**
   * Merge two contacts, preferring new non-null/non-empty values
   */
  mergeContacts: (
    _existing: LeadPointOfContact,
    newContact: Omit<NewLeadPointOfContact, 'leadId'>
  ): Partial<LeadPointOfContact> => {
    const merged: Partial<LeadPointOfContact> = {};

    // Merge each field - use new value if it exists and is not empty, otherwise keep existing
    if (newContact.name && newContact.name.trim() !== '') {
      merged.name = newContact.name;
    }

    if (newContact.email && newContact.email.trim() !== '') {
      merged.email = newContact.email;
    }

    if (newContact.phone && newContact.phone.trim() !== '') {
      merged.phone = newContact.phone;
    }

    if (newContact.title && newContact.title.trim() !== '') {
      merged.title = newContact.title;
    }

    if (newContact.company && newContact.company.trim() !== '') {
      merged.company = newContact.company;
    }

    if (newContact.sourceUrl && newContact.sourceUrl.trim() !== '') {
      merged.sourceUrl = newContact.sourceUrl;
    }

    // Always update the updatedAt timestamp
    merged.updatedAt = new Date();

    return merged;
  },

  /**
   * Update an existing contact
   */
  updateContact: async (
    contactId: string,
    updates: Partial<LeadPointOfContact>
  ): Promise<LeadPointOfContact | null> => {
    try {
      const [updatedContact] = await db
        .update(leadPointOfContacts)
        .set(updates)
        .where(eq(leadPointOfContacts.id, contactId))
        .returning();

      return updatedContact || null;
    } catch (error) {
      logger.error('Error updating contact:', error);
      throw error;
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
      sourceUrl: extractedContact.sourceUrl || null,
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
