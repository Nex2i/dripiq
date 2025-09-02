import { compareTwoStrings } from 'string-similarity';
import { getWebDataService } from '@/libs/webData';
import {
  WebDataEmployee,
  WebDataCompanyEmployeesResult,
} from '@/libs/webData/interfaces/webData.interface';
import { logger } from '@/libs/logger';
import { ExtractedContact } from './schemas/contactExtractionSchema';

export interface FormattedWebDataContact {
  name: string;
  email?: string;
  title?: string;
  priority: 'high' | 'medium' | 'low';
  linkedinUrl?: string;
  department?: string;
}

export interface WebDataContactSummary {
  contacts: FormattedWebDataContact[];
  totalFound: number;
  companyName?: string;
}

const DEFAULT_WEBDATA_LIMIT = 15;

/**
 * Fetch and format webData contacts for prompt injection
 * Creates a smaller, optimized payload to reduce token usage
 */
export async function fetchWebDataContacts(domain: string): Promise<WebDataContactSummary> {
  try {
    logger.info('Fetching webData contacts for domain', { domain });

    const webDataService = getWebDataService();
    const webDataResult: WebDataCompanyEmployeesResult =
      await webDataService.getEmployeesByCompanyDomain(domain, { limit: DEFAULT_WEBDATA_LIMIT });

    // Extract current employees (prioritize over former)
    let currentEmployees = webDataResult.employees.current || [];

    const formattedContacts = currentEmployees
      .map((employee) => formatEmployee(employee))
      .sort((a, b) => {
        // Sort by priority: high -> medium -> low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    logger.info('WebData contacts processed', {
      domain,
      totalEmployees: currentEmployees.length,
      contactsWithEmails: formattedContacts.length,
    });

    return {
      contacts: formattedContacts,
      totalFound: formattedContacts.length,
      companyName: webDataResult.company?.name,
    };
  } catch (error) {
    logger.error('Failed to fetch webData contacts', { domain, error: String(error) });

    // Return empty result on error to not break the extraction process
    return {
      contacts: [],
      totalFound: 0,
    };
  }
}

/**
 * Format a webData employee into a smaller contact structure
 */
function formatEmployee(employee: WebDataEmployee): FormattedWebDataContact {
  const name =
    employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  const title = employee.job_title;
  const email = employee.email;
  const linkedinUrl = employee.linkedin_url;
  const department = employee.job_department;

  // Determine priority based on job title
  const priority = determinePriority(title, department);

  return {
    name: name || 'Unknown',
    email,
    title,
    priority,
    linkedinUrl,
    department,
  };
}

/**
 * Determine contact priority based on job title and department
 */
function determinePriority(title?: string, department?: string): 'high' | 'medium' | 'low' {
  if (!title) return 'low';

  const titleLower = title.toLowerCase();
  const deptLower = department?.toLowerCase() || '';

  // High priority: C-level executives
  if (
    titleLower.includes('ceo') ||
    titleLower.includes('chief') ||
    titleLower.includes('president') ||
    titleLower.includes('founder') ||
    titleLower.includes('owner')
  ) {
    return 'high';
  }

  // High priority: VP/Director level in key departments
  if (
    (titleLower.includes('vp') ||
      titleLower.includes('vice president') ||
      titleLower.includes('director')) &&
    (titleLower.includes('sales') ||
      titleLower.includes('business development') ||
      titleLower.includes('partnership') ||
      titleLower.includes('marketing') ||
      deptLower.includes('sales') ||
      deptLower.includes('business development'))
  ) {
    return 'high';
  }

  // Medium priority: Sales, BD, Marketing roles
  if (
    titleLower.includes('sales') ||
    titleLower.includes('business development') ||
    titleLower.includes('account manager') ||
    titleLower.includes('partnership') ||
    titleLower.includes('marketing') ||
    deptLower.includes('sales') ||
    deptLower.includes('marketing')
  ) {
    return 'medium';
  }

  // Low priority: Other roles
  return 'low';
}

/**
 * Format webData contacts for prompt injection
 */
export function formatWebDataContactsForPrompt(summary: WebDataContactSummary): string {
  if (summary.totalFound === 0) {
    return 'No contacts found in webData for this domain.';
  }

  const contactsList = summary.contacts
    .map((contact) => {
      const parts = [
        `- ${contact.name}`,
        contact.title ? `(${contact.title})` : '',
        contact.email ? `- ${contact.email}` : '',
        `- ${contact.priority.charAt(0).toUpperCase() + contact.priority.slice(1)} Priority`,
      ].filter(Boolean);

      return parts.join(' ');
    })
    .join('\n');

  return `**WebData Contacts Found (${summary.totalFound} contacts):**
${contactsList}

**Instructions for using WebData contacts:**
- Use these as your starting point for contact extraction
- When you find emails on the website, compare them with webData emails
- ONLY overwrite webData emails if the website email is MORE SPECIFIC (not generic)
- DO NOT overwrite with generic emails like: sales@, info@, office@, support@, contact@, admin@, hello@
- Merge additional information found on website (phone, address, LinkedIn) with webData contacts
- Prioritize contacts marked as "High Priority" in your final selection`;
}

/**
 * Convert FormattedWebDataContact to ExtractedContact format for consistency
 */
export function convertWebDataToExtractedContact(
  webDataContact: FormattedWebDataContact
): ExtractedContact {
  return {
    name: webDataContact.name,
    email: webDataContact.email || null,
    phone: null, // webData doesn't typically have phone numbers
    title: webDataContact.title || null,
    company: null, // webData contacts are from the same company
    contactType: 'individual' as const,
    context: webDataContact.department
      ? `${webDataContact.department} Department`
      : 'WebData Employee',
    isPriorityContact: webDataContact.priority === 'high',
    address: null,
    linkedinUrl: webDataContact.linkedinUrl || null,
    websiteUrl: null,
    sourceUrl: null,
    confidence: 'high' as const, // webData is typically high confidence
  };
}

/**
 * Merge webData contacts with AI-extracted contacts
 * Uses name as the merge identifier, preferring AI details when both sources have data
 */
export function mergeContactSources(
  webDataSummary: WebDataContactSummary,
  aiContacts: ExtractedContact[]
): {
  webDataContacts: ExtractedContact[];
  enrichedContacts: ExtractedContact[];
  aiOnlyContacts: ExtractedContact[];
} {
  logger.info('Starting webData-first contact merge process', {
    webDataCount: webDataSummary.contacts.length,
    aiContactCount: aiContacts.length,
  });

  // Convert webData contacts to ExtractedContact format - these are always preserved
  const webDataAsExtracted = webDataSummary.contacts.map(convertWebDataToExtractedContact);

  // Track processed names to avoid duplicates
  const processedNames = new Set<string>();
  const enrichedContacts: ExtractedContact[] = [];
  const aiOnlyContacts: ExtractedContact[] = [];

  // First, process all webData contacts and enrich them with AI data
  for (const webDataContact of webDataAsExtracted) {
    const normalizedName = webDataContact.name.toLowerCase().trim();
    processedNames.add(normalizedName);

    // Find matching AI contact for enrichment
    const matchingAiContact = findMatchingContactByName(webDataContact, aiContacts);

    if (matchingAiContact) {
      // Enrich webData contact with AI data
      const enrichedContact = mergeContactDetails(webDataContact, matchingAiContact);
      enrichedContacts.push(enrichedContact);
      logger.debug(`Enriched webData contact with AI data: ${enrichedContact.name}`);
    } else {
      // No AI enrichment available, keep webData contact as-is
      enrichedContacts.push(webDataContact);
      logger.debug(`Preserved webData-only contact: ${webDataContact.name}`);
    }
  }

  // Then, add AI-only contacts that don't match any webData contacts
  for (const aiContact of aiContacts) {
    const normalizedName = aiContact.name.toLowerCase().trim();

    if (!processedNames.has(normalizedName)) {
      // Check if this AI contact is similar to any webData contact we haven't matched yet
      const matchingWebDataContact = findMatchingContactByName(aiContact, webDataAsExtracted);

      if (!matchingWebDataContact) {
        // This is a truly new AI contact
        aiOnlyContacts.push(aiContact);
        processedNames.add(normalizedName);
        logger.debug(`Added AI-only contact: ${aiContact.name}`);
      }
    }
  }

  logger.info('WebData-first contact merge completed', {
    originalWebData: webDataSummary.contacts.length,
    originalAI: aiContacts.length,
    webDataPreserved: webDataAsExtracted.length,
    enrichedContacts: enrichedContacts.length,
    aiOnlyContacts: aiOnlyContacts.length,
  });

  return {
    webDataContacts: webDataAsExtracted,
    enrichedContacts,
    aiOnlyContacts,
  };
}

/**
 * Find matching contact by name using similarity scoring
 */
function findMatchingContactByName(
  targetContact: ExtractedContact,
  contacts: ExtractedContact[],
  threshold: number = 0.8
): ExtractedContact | null {
  const targetName = targetContact.name.toLowerCase().trim();

  let bestMatch: ExtractedContact | null = null;
  let bestScore = 0;

  for (const contact of contacts) {
    const contactName = contact.name.toLowerCase().trim();
    const similarity = compareTwoStrings(targetName, contactName);

    if (similarity > threshold && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = contact;
    }
  }

  return bestMatch;
}

/**
 * Merge two contacts, preferring AI data but filling gaps with webData
 */
function mergeContactDetails(
  webDataContact: ExtractedContact,
  aiContact: ExtractedContact
): ExtractedContact {
  // Helper function to choose between two values, preferring AI but allowing webData to fill gaps
  const mergeField = (aiValue: any, webDataValue: any) => {
    // If AI has a value, use it
    if (aiValue !== null && aiValue !== undefined && aiValue !== '') {
      return aiValue;
    }
    // Otherwise use webData value
    return webDataValue;
  };

  // For completeness check: if one source has "complete" info, prefer it
  const aiCompleteness = calculateContactCompleteness(aiContact);
  const webDataCompleteness = calculateContactCompleteness(webDataContact);

  // If one source is significantly more complete (>2 additional fields), prefer it entirely
  if (webDataCompleteness - aiCompleteness >= 2) {
    logger.debug(`Using webData contact entirely due to completeness: ${webDataContact.name}`);
    return { ...webDataContact, isPriorityContact: aiContact.isPriorityContact }; // Keep AI priority flag
  } else if (aiCompleteness - webDataCompleteness >= 2) {
    logger.debug(`Using AI contact entirely due to completeness: ${aiContact.name}`);
    return aiContact;
  }

  // Otherwise merge field by field, preferring AI
  return {
    name: mergeField(aiContact.name, webDataContact.name),
    email: mergeField(aiContact.email, webDataContact.email),
    phone: mergeField(aiContact.phone, webDataContact.phone),
    title: mergeField(aiContact.title, webDataContact.title),
    company: mergeField(aiContact.company, webDataContact.company),
    contactType: aiContact.contactType, // Prefer AI's assessment of contact type
    context: mergeField(aiContact.context, webDataContact.context),
    isPriorityContact: aiContact.isPriorityContact, // AI determines priority
    address: mergeField(aiContact.address, webDataContact.address),
    linkedinUrl: mergeField(aiContact.linkedinUrl, webDataContact.linkedinUrl),
    websiteUrl: mergeField(aiContact.websiteUrl, webDataContact.websiteUrl),
    sourceUrl: mergeField(aiContact.sourceUrl, webDataContact.sourceUrl),
    confidence: aiContact.confidence, // Use AI's confidence assessment
  };
}

/**
 * Calculate how complete a contact's information is (0-7 scale)
 */
function calculateContactCompleteness(contact: ExtractedContact): number {
  let completeness = 0;

  if (contact.email) completeness++;
  if (contact.phone) completeness++;
  if (contact.title) completeness++;
  if (contact.address) completeness++;
  if (contact.linkedinUrl) completeness++;
  if (contact.websiteUrl) completeness++;
  if (contact.company) completeness++;

  return completeness;
}
