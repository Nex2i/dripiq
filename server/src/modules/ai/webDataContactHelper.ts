import { getWebDataService } from '@/libs/webData';
import {
  WebDataEmployee,
  WebDataCompanyEmployeesResult,
} from '@/libs/webData/interfaces/webData.interface';
import { logger } from '@/libs/logger';

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

/**
 * Fetch and format webData contacts for prompt injection
 * Creates a smaller, optimized payload to reduce token usage
 */
export async function fetchWebDataContacts(domain: string): Promise<WebDataContactSummary> {
  try {
    logger.info('Fetching webData contacts for domain', { domain });

    const webDataService = getWebDataService();
    const webDataResult: WebDataCompanyEmployeesResult =
      await webDataService.getEmployeesByCompanyDomain(domain);

    // Extract current employees (prioritize over former)
    const currentEmployees = webDataResult.employees.current || [];

    // Filter and format contacts
    const formattedContacts = currentEmployees
      .filter((employee) => employee.email) // Only include employees with emails
      .map((employee) => formatEmployee(employee))
      .sort((a, b) => {
        // Sort by priority: high -> medium -> low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 10); // Limit to top 10 contacts to control prompt size

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
