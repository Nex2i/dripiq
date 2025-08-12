import { compareTwoStrings } from 'string-similarity';
import { logger } from '@/libs/logger';
import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';
import { leadPointOfContactRepository, leadRepository } from '@/repositories';
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

      // Soft-cap to 5 for processing order, but keep original for dedup/priority alignment
      const contacts = extractionResult.finalResponseParsed.contacts;
      const priorityContactIndex = extractionResult.finalResponseParsed.priorityContactId;

      // Deduplicate contacts before processing
      const { deduplicatedContacts, updatedPriorityIndex } =
        ContactExtractionService.deduplicateContacts(contacts, priorityContactIndex);

      logger.info(
        `Found ${contacts.length} contacts, deduplicated to ${deduplicatedContacts.length} for domain: ${domain}`
      );

      // Enforce soft cap of 5 for processing order, preserving model-provided order
      const toProcess = deduplicatedContacts.slice(0, 5);

      // Get existing contacts for the lead
      const existingContacts = await ContactExtractionService.getExistingContacts(leadId);

      // Enforce hard cap of 6 total contacts for a lead by trimming creations
      const remainingSlots = Math.max(0, 6 - existingContacts.length);
      const cappedToProcess = remainingSlots > 0 ? toProcess.slice(0, remainingSlots) : [];

      // Compute priority index within the truncated list
      const newPriorityIndex =
        updatedPriorityIndex !== null &&
        updatedPriorityIndex !== undefined &&
        updatedPriorityIndex < toProcess.length
          ? updatedPriorityIndex
          : null;

      // Process and save contacts with merging
      const processedContacts = await ContactExtractionService.processAndMergeContacts(
        tenantId,
        leadId,
        cappedToProcess,
        existingContacts,
        newPriorityIndex
      );

      logger.info(
        `Successfully processed ${processedContacts.created} new and ${processedContacts.updated} updated contacts for leadId: ${leadId}`
      );

      // Set primary contact if priority contact was identified
      if (processedContacts.primaryContactId) {
        await ContactExtractionService.updateLeadPrimaryContact(
          leadId,
          processedContacts.primaryContactId
        );
        logger.info(
          `Set primary contact ${processedContacts.primaryContactId} for leadId: ${leadId}`
        );
      }

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
  deduplicateContacts: (
    contacts: ExtractedContact[],
    priorityContactIndex?: number | null
  ): { deduplicatedContacts: ExtractedContact[]; updatedPriorityIndex: number | null } => {
    const deduplicatedContacts: ExtractedContact[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    let updatedPriorityIndex: number | null = null;

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
      const normalizedPhone = contact.phone
        ? ContactExtractionService.normalizePhone(contact.phone)
        : null;
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

      // Update priority index if this was the priority contact
      if (
        priorityContactIndex !== null &&
        priorityContactIndex !== undefined &&
        i === priorityContactIndex
      ) {
        updatedPriorityIndex = deduplicatedContacts.length - 1;
      }
    }

    // If priority contact was removed due to duplication, try to find a priority contact by flag
    if (priorityContactIndex !== null && updatedPriorityIndex === null) {
      const priorityContactByFlag = deduplicatedContacts.findIndex(
        (contact) => contact.isPriorityContact
      );
      if (priorityContactByFlag >= 0) {
        updatedPriorityIndex = priorityContactByFlag;
        logger.info(`Priority contact index updated due to deduplication: ${updatedPriorityIndex}`);
      }
    }

    return { deduplicatedContacts, updatedPriorityIndex };
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
   * Process extracted contacts and merge with existing ones
   */
  processAndMergeContacts: async (
    tenantId: string,
    leadId: string,
    extractedContacts: ExtractedContact[],
    existingContacts: LeadPointOfContact[],
    priorityContactIndex?: number | null
  ) => {
    const results = {
      created: 0,
      updated: 0,
      contacts: [] as LeadPointOfContact[],
      primaryContactId: null as string | null,
    };

    // Respect hard cap of 6 by skipping creates when full, still allow updates/merges
    let totalExisting = existingContacts.length;

    for (let i = 0; i < extractedContacts.length; i++) {
      const extractedContact = extractedContacts[i];
      if (!extractedContact) continue;

      try {
        const leadContact = ContactExtractionService.transformToLeadContact(extractedContact);

        // Find similar existing contact
        const similarContact = ContactExtractionService.findSimilarContact(
          leadContact,
          existingContacts
        );

        let contactId: string | undefined;

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
            contactId = updatedContact.id;
            logger.debug(`Updated contact: ${extractedContact.name} for leadId: ${leadId}`);
          } else {
            continue;
          }
        } else {
          // If we reached hard cap, skip creating new contact
          if (totalExisting >= 6) {
            logger.info(
              `Skipping creation of new contact due to hard cap (6) reached for leadId: ${leadId}`
            );
            continue;
          }

          const createdContact = await createContact(tenantId, leadId, leadContact);
          results.created++;
          results.contacts.push(createdContact);
          contactId = createdContact.id;
          totalExisting++;
          logger.debug(`Created contact: ${extractedContact.name} for leadId: ${leadId}`);
        }

        // Check if this is the priority contact
        if (
          priorityContactIndex !== null &&
          priorityContactIndex !== undefined &&
          i === priorityContactIndex &&
          contactId
        ) {
          results.primaryContactId = contactId;
          logger.info(
            `Identified priority contact: ${extractedContact.name} (${contactId}) for leadId: ${leadId}`
          );
        }
      } catch (error) {
        logger.warn(
          `Failed to process contact ${extractedContact.name || 'unknown'} for leadId: ${leadId}:`,
          error
        );
        // Continue processing other contacts even if one fails
      }
    }

    // Fallback: if no priority contact was explicitly identified, use the first contact with isPriorityContact=true
    if (!results.primaryContactId && extractedContacts.length > 0) {
      const priorityContact = extractedContacts.find((contact) => contact?.isPriorityContact);
      if (priorityContact) {
        const priorityIndex = extractedContacts.indexOf(priorityContact);
        if (
          priorityIndex >= 0 &&
          priorityIndex < results.contacts.length &&
          results.contacts[priorityIndex]
        ) {
          results.primaryContactId = results.contacts[priorityIndex].id;
          logger.info(
            `Fallback: Found priority contact by isPriorityContact flag: ${priorityContact.name} for leadId: ${leadId}`
          );
        }
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
      const phone1 = ContactExtractionService.normalizePhone(contact1.phone);
      const phone2 = ContactExtractionService.normalizePhone(contact2.phone);

      if (phone1 === phone2) {
        return 1.0; // Perfect match on phone
      } else {
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
