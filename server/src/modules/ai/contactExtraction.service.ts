import { compareTwoStrings } from 'string-similarity';
import { logger } from '@/libs/logger';
import { formatPhoneForStorage, normalizePhoneForComparison } from '@/libs/phoneFormatter';
import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';
import { leadPointOfContactRepository, leadRepository } from '@/repositories';
import { createContact } from '../lead.service';
import { ExtractedContact } from './schemas/contactExtraction/contactExtractionSchema';
import { CONTACT_CONTEXT, CONTACT_CONFIDENCE } from './constants/contactContext';
import { contactExtractionAgent } from './langchain';
import { emailListVerifyClient } from '@/libs/email/emailListVerify.client';

/**
 * Helper function to identify if a contact is from webData
 */
const isWebDataContact = (contact: ExtractedContact): boolean => {
  return (
    contact.context === CONTACT_CONTEXT.WEBDATA_EMPLOYEE ||
    (!!contact.context &&
      contact.context.includes(CONTACT_CONTEXT.DEPARTMENT_SUFFIX) &&
      contact.confidence === CONTACT_CONFIDENCE.HIGH)
  );
};

export const ContactExtractionService = {
  /**
   * Extract contacts from a domain and save them to a lead
   */
  extractAndSaveContacts: async (tenantId: string, leadId: string, domain: string) => {
    try {
      logger.info(`Starting contact extraction for domain: ${domain}, leadId: ${leadId}`);

      // Extract contacts using the agent
      const extractionResult = await contactExtractionAgent.execute(domain, tenantId, {
        leadId,
        domain,
      });

      if (!extractionResult.finalResponseParsed?.contacts) {
        logger.warn(`No contacts found for domain: ${domain}`);
        return {
          contactsCreated: 0,
          summary: extractionResult.finalResponseParsed?.summary || 'No contacts found',
          extractionResult,
        };
      }

      const contacts = extractionResult.finalResponseParsed.contacts;

      // Separate webData contacts from AI-only contacts based on context
      const webDataContacts = contacts.filter(isWebDataContact);
      const aiOnlyContacts = contacts.filter((contact) => !isWebDataContact(contact));

      logger.info(
        `Contact breakdown for ${domain}: ${webDataContacts.length} webData, ${aiOnlyContacts.length} AI-only, ${contacts.length} total`
      );

      // Get existing contacts for the lead
      const existingContacts = await ContactExtractionService.getExistingContacts(leadId);

      // Combine for final processing: webData first, then AI-only
      const allToProcess = [...webDataContacts, ...aiOnlyContacts];

      // Deduplicate the final list
      const deduplicatedContacts = ContactExtractionService.deduplicateContacts(allToProcess);

      logger.info(
        `Processing all contacts for ${domain}: ${webDataContacts.length} webData, ${aiOnlyContacts.length} AI-only, ${deduplicatedContacts.length} after deduplication`
      );

      // Process and save contacts with merging
      const processedContacts = await ContactExtractionService.processAndMergeContacts(
        tenantId,
        leadId,
        deduplicatedContacts,
        existingContacts
      );

      logger.info(
        `Successfully processed ${processedContacts.created} new and ${processedContacts.updated} updated contacts for leadId: ${leadId}`
      );

      return {
        contactsCreated: processedContacts.created,
        contactsUpdated: processedContacts.updated,
        primaryContactId: processedContacts.primaryContactId,
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
   * Deduplicate contacts based on email, phone, and name similarity
   */
  deduplicateContacts: (contacts: ExtractedContact[]): ExtractedContact[] => {
    const deduplicatedContacts: ExtractedContact[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      if (!contact) continue;

      // Validate contact first (includes generic template filtering)
      if (!ContactExtractionService.validateContact(contact)) {
        logger.debug(`Skipping invalid/generic contact: ${contact.name}`);
        continue;
      }

      // Check for email duplicates
      const normalizedEmail = contact.email?.toLowerCase().trim();
      if (normalizedEmail && seenEmails.has(normalizedEmail)) {
        logger.debug(`Skipping duplicate email contact: ${contact.name} (${normalizedEmail})`);
        continue;
      }

      // Check for phone duplicates
      const normalizedPhone = contact.phone ? normalizePhoneForComparison(contact.phone) : null;
      if (normalizedPhone && seenPhones.has(normalizedPhone)) {
        logger.debug(`Skipping duplicate phone contact: ${contact.name} (${normalizedPhone})`);
        continue;
      }

      // Check for name-based duplicates (similar names with same contact type)
      const isDuplicateName = deduplicatedContacts.some((existingContact) => {
        if (contact.contactType !== existingContact.contactType) return false;

        const nameSimilarity = compareTwoStrings(
          contact.name.toLowerCase().trim(),
          existingContact.name.toLowerCase().trim()
        );

        // Consider it a duplicate if names are very similar (>80%) and same contact type
        return nameSimilarity > 0.8;
      });

      if (isDuplicateName) {
        logger.debug(`Skipping duplicate name contact: ${contact.name}`);
        continue;
      }

      // Add to deduplicated list
      deduplicatedContacts.push(contact);

      // Track seen values
      if (normalizedEmail) seenEmails.add(normalizedEmail);
      if (normalizedPhone) seenPhones.add(normalizedPhone);
    }

    return deduplicatedContacts;
  },

  /**
   * Update the primary contact for a lead
   */
  updateLeadPrimaryContact: async (leadId: string, primaryContactId: string): Promise<void> => {
    try {
      await leadRepository.updateById(leadId, { primaryContactId });
    } catch (error) {
      logger.error('Error updating lead primary contact:', error);
      throw error;
    }
  },

  /**
   * Get existing contacts for a lead
   */
  getExistingContacts: async (leadId: string): Promise<LeadPointOfContact[]> => {
    try {
      const contacts = await leadPointOfContactRepository.findByLeadId(leadId);

      return contacts;
    } catch (error) {
      logger.error('Error getting existing contacts:', error);
      return [];
    }
  },

  /**
   * Transform extracted contacts to lead contact format with similarity matching
   */
  transformAndMatchContacts: (
    extractedContacts: ExtractedContact[],
    existingContacts: LeadPointOfContact[]
  ): Array<{
    extractedContact: ExtractedContact;
    leadContact: Omit<NewLeadPointOfContact, 'leadId'>;
    similarContact: LeadPointOfContact | null;
  }> => {
    const contactsToProcess: Array<{
      extractedContact: ExtractedContact;
      leadContact: Omit<NewLeadPointOfContact, 'leadId'>;
      similarContact: LeadPointOfContact | null;
    }> = [];

    for (let i = 0; i < extractedContacts.length; i++) {
      const extractedContact = extractedContacts[i];
      if (!extractedContact) continue;

      try {
        const leadContact = ContactExtractionService.transformToLeadContact(extractedContact);
        const similarContact = ContactExtractionService.findSimilarContact(
          leadContact,
          existingContacts
        );

        contactsToProcess.push({
          extractedContact,
          leadContact,
          similarContact,
        });
      } catch (error) {
        logger.warn(`Failed to transform contact ${extractedContact.name || 'unknown'}:`, error);
        // Continue processing other contacts even if one fails
      }
    }

    return contactsToProcess;
  },

  /**
   * Group contacts into create and update operations
   */
  groupContactsForBatchOperations: (
    contactsToProcess: Array<{
      extractedContact: ExtractedContact;
      leadContact: Omit<NewLeadPointOfContact, 'leadId'>;
      similarContact: LeadPointOfContact | null;
    }>
  ): {
    contactsToCreate: Omit<NewLeadPointOfContact, 'leadId'>[];
    contactsToUpdate: Array<{
      id: string;
      data: Partial<LeadPointOfContact>;
    }>;
  } => {
    const contactsToCreate: Omit<NewLeadPointOfContact, 'leadId'>[] = [];
    const contactsToUpdate: Array<{
      id: string;
      data: Partial<LeadPointOfContact>;
    }> = [];

    for (const contactProcess of contactsToProcess) {
      if (contactProcess.similarContact) {
        // Merge and prepare for update
        const mergedContact = ContactExtractionService.mergeContacts(
          contactProcess.similarContact,
          contactProcess.leadContact
        );

        contactsToUpdate.push({
          id: contactProcess.similarContact.id,
          data: mergedContact,
        });
      } else {
        // Prepare for creation
        contactsToCreate.push(contactProcess.leadContact);
      }
    }

    return { contactsToCreate, contactsToUpdate };
  },

  /**
   * Clean Emails and assigned email validation
   */
  cleanEmailsAndAssignedEmailValidation: async (
    contactsToCreate: Omit<NewLeadPointOfContact, 'leadId'>[],
    contactsToUpdate: Array<{
      id: string;
      data: Partial<LeadPointOfContact>;
    }>
  ): Promise<void> => {
    const allEmails = [
      ...contactsToCreate.map((contact) => contact.email),
      ...contactsToUpdate.map((contact) => contact.data.email),
    ].filter((email) => email && email.isValidEmail() && email.trim() !== '') as string[];
    const emailListVerifyResponses =
      await emailListVerifyClient.verifyEmailDetailedBatch(allEmails);

    for (const contact of contactsToCreate) {
      if (contact.email) {
        const verificationResult = emailListVerifyResponses[contact.email];
        if (verificationResult) {
          contact.emailVerificationResult =
            emailListVerifyClient.mapResultToEmailVerificationResult(verificationResult);
        }
      }
    }
    for (const contact of contactsToUpdate) {
      if (contact.data.email) {
        const verificationResult = emailListVerifyResponses[contact.data.email];
        if (verificationResult) {
          contact.data.emailVerificationResult =
            emailListVerifyClient.mapResultToEmailVerificationResult(verificationResult);
        }
      }
    }
  },

  /**
   * Execute batch operations for contact creation and updates
   */
  executeBatchContactOperations: async (
    tenantId: string,
    leadId: string,
    contactsToCreate: Omit<NewLeadPointOfContact, 'leadId'>[],
    contactsToUpdate: Array<{
      id: string;
      data: Partial<LeadPointOfContact>;
    }>
  ): Promise<{
    created: number;
    updated: number;
    contacts: LeadPointOfContact[];
  }> => {
    let createdContacts: LeadPointOfContact[] = [];
    let updatedContacts: LeadPointOfContact[] = [];

    // Batch create contacts
    if (contactsToCreate.length > 0) {
      try {
        // Use the existing createContact function for now, but we could optimize this further
        // by using batch creation if available
        const createPromises = contactsToCreate.map((leadContact) =>
          createContact(tenantId, leadId, leadContact)
        );
        createdContacts = await Promise.all(createPromises);

        logger.debug(`Batch created ${createdContacts.length} contacts for leadId: ${leadId}`);
      } catch (error) {
        logger.error(`Failed to batch create contacts for leadId: ${leadId}:`, error);
        // Continue with updates even if creation fails
      }
    }

    // Batch update contacts
    if (contactsToUpdate.length > 0) {
      try {
        updatedContacts = await leadPointOfContactRepository.updateMultipleByIdsForTenant(
          contactsToUpdate,
          tenantId
        );

        logger.debug(`Batch updated ${updatedContacts.length} contacts for leadId: ${leadId}`);
      } catch (error) {
        logger.error(`Failed to batch update contacts for leadId: ${leadId}:`, error);
        // Continue even if updates fail
      }
    }

    return {
      created: createdContacts.length,
      updated: updatedContacts.length,
      contacts: [...createdContacts, ...updatedContacts],
    };
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
      primaryContactId: null as string | null,
    };

    if (extractedContacts.length === 0) {
      return results;
    }

    try {
      // Transform and match contacts
      const contactsToProcess = ContactExtractionService.transformAndMatchContacts(
        extractedContacts,
        existingContacts
      );

      // Group for batch operations
      const { contactsToCreate, contactsToUpdate } =
        ContactExtractionService.groupContactsForBatchOperations(contactsToProcess);

      // Clean Emails and assign email validation
      await ContactExtractionService.cleanEmailsAndAssignedEmailValidation(
        contactsToCreate,
        contactsToUpdate
      );

      // Execute batch operations
      const batchResults = await ContactExtractionService.executeBatchContactOperations(
        tenantId,
        leadId,
        contactsToCreate,
        contactsToUpdate
      );

      results.created = batchResults.created;
      results.updated = batchResults.updated;
      results.contacts = batchResults.contacts;

      // Log results
      logger.info(
        `Successfully processed ${results.created} new and ${results.updated} updated contacts for leadId: ${leadId}`
      );
    } catch (error) {
      logger.error(`Error in batch contact processing for leadId: ${leadId}:`, error);
      throw error;
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
   * Enhanced contact similarity calculation with better deduplication logic
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

    // Exact email match gets highest priority
    if (contact1.email && contact2.email) {
      const email1 = contact1.email.toLowerCase().trim();
      const email2 = contact2.email.toLowerCase().trim();
      if (email1 === email2) {
        return 1.0; // Perfect match on email
      }
      const emailScore = compareTwoStrings(email1, email2);
      totalScore += emailScore * weights.email;
      totalWeight += weights.email;
    }

    // Exact phone match also gets high priority
    if (contact1.phone && contact2.phone) {
      const phone1 = normalizePhoneForComparison(contact1.phone);
      const phone2 = normalizePhoneForComparison(contact2.phone);

      if (phone1 === phone2) {
        return 1.0; // Perfect match on phone
      } else if (phone1 && phone2) {
        const phoneScore = compareTwoStrings(phone1, phone2);
        totalScore += phoneScore * weights.phone;
      }
      totalWeight += weights.phone;
    }

    // Name similarity (most important after exact contact matches)
    if (contact1.name && contact2.name) {
      const nameScore = compareTwoStrings(
        contact1.name.toLowerCase().trim(),
        contact2.name.toLowerCase().trim()
      );
      totalScore += nameScore * weights.name;
      totalWeight += weights.name;
    }

    // Return weighted average
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  },

  /**
   * Merge two contacts, preferring new non-null/non-empty values
   */
  mergeContacts: (
    existing: LeadPointOfContact,
    newContact: Omit<NewLeadPointOfContact, 'leadId'>
  ): Partial<LeadPointOfContact> => {
    const merged: Partial<LeadPointOfContact> = { ...existing };

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
      const updatedContact = await leadPointOfContactRepository.updateById(contactId, updates);

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
    extractedContacts: ExtractedContact[],
    priorityContactIndex?: number | null
  ) => {
    const createdContacts = [];
    let primaryContactId: string | null = null;

    for (let i = 0; i < extractedContacts.length; i++) {
      const contact = extractedContacts[i];
      if (!contact) continue;

      try {
        const leadContact = ContactExtractionService.transformToLeadContact(contact);

        // Create the contact
        const createdContact = await createContact(tenantId, leadId, leadContact);
        createdContacts.push(createdContact);

        // Check if this is the priority contact
        if (
          priorityContactIndex !== null &&
          priorityContactIndex !== undefined &&
          i === priorityContactIndex
        ) {
          primaryContactId = createdContact.id;
          logger.info(
            `Identified priority contact: ${contact.name} (${createdContact.id}) for leadId: ${leadId}`
          );
        }

        logger.debug(`Created contact: ${contact.name} for leadId: ${leadId}`);
      } catch (error) {
        logger.warn(
          `Failed to create contact ${contact.name || 'unknown'} for leadId: ${leadId}:`,
          error
        );
        // Continue processing other contacts even if one fails
      }
    }

    // Fallback: if no priority contact was explicitly identified, use the first contact with isPriorityContact=true
    if (!primaryContactId && extractedContacts.length > 0) {
      const priorityContact = extractedContacts.find((contact) => contact?.isPriorityContact);
      if (priorityContact) {
        const priorityIndex = extractedContacts.indexOf(priorityContact);
        if (
          priorityIndex >= 0 &&
          priorityIndex < createdContacts.length &&
          createdContacts[priorityIndex]
        ) {
          primaryContactId = createdContacts[priorityIndex].id;
          logger.info(
            `Fallback: Found priority contact by isPriorityContact flag: ${priorityContact.name} for leadId: ${leadId}`
          );
        }
      }
    }

    // Set primary contact if identified
    if (primaryContactId) {
      await ContactExtractionService.updateLeadPrimaryContact(leadId, primaryContactId);
      logger.info(`Set primary contact ${primaryContactId} for leadId: ${leadId}`);
    }

    return { contacts: createdContacts, primaryContactId };
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
      phone: formatPhoneForStorage(extractedContact.phone),
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

    // Check if this is likely a generic/template contact that should be filtered
    if (ContactExtractionService.isGenericTemplateContact(contact)) {
      logger.debug(`Filtering out generic template contact: ${contact.name}`);
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

  /**
   * Detect if a contact is likely generic template information that appears in headers/footers
   */
  isGenericTemplateContact: (contact: ExtractedContact): boolean => {
    const name = contact.name.toLowerCase();
    const email = contact.email?.toLowerCase() || '';
    const context = contact.context?.toLowerCase() || '';
    const sourceUrl = contact.sourceUrl?.toLowerCase() || '';

    // Generic email patterns that are likely template content
    const genericEmailPatterns = [
      /^info@/,
      /^contact@/,
      /^hello@/,
      /^general@/,
      /^office@/,
      /^main@/,
      /^admin@/,
      /^webmaster@/,
      /^noreply@/,
      /^no-reply@/,
    ];

    // Generic name patterns
    const genericNamePatterns = [
      'contact us',
      'get in touch',
      'main office',
      'headquarters',
      'customer service',
      'general inquiry',
      'information',
      'contact form',
      'contact page',
    ];

    // Check if email matches generic patterns
    if (email && genericEmailPatterns.some((pattern) => pattern.test(email))) {
      // If it's a generic email AND appears in multiple common locations, it's likely template content
      const templateIndicators = [
        context.includes('header'),
        context.includes('footer'),
        context.includes('navigation'),
        context.includes('widget'),
        sourceUrl.includes('contact'),
        sourceUrl.includes('footer'),
        sourceUrl.includes('header'),
      ];

      // If 2 or more template indicators, consider it template content
      if (templateIndicators.filter(Boolean).length >= 2) {
        return true;
      }
    }

    // Check if name matches generic patterns
    if (genericNamePatterns.some((pattern) => name.includes(pattern))) {
      return true;
    }

    return false;
  },
};
