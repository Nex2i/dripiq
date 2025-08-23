import { logger } from '@/libs/logger';
import { NewLead, NewLeadPointOfContact } from '@/db/schema';
import { createLead } from './lead.service';
import { createContact } from './contact.service';
import { CampaignCreationPublisher } from './messages/campaignCreation.publisher.service';

export interface BulkCampaignRequest {
  emails: string;
  leadName: string;
  tenantId: string;
  body: string;
}

export interface ContactResult {
  id: string;
  name: string;
  email: string;
  campaignId?: string;
  success: boolean;
  error?: string;
}

export interface BulkCampaignResult {
  leadId: string;
  leadName: string;
  tenantId: string;
  totalEmails: number;
  successfulContacts: number;
  successfulCampaigns: number;
  contacts: ContactResult[];
}

/**
 * Parses comma-separated email string and extracts individual emails
 * @param emails - Comma-separated email string
 * @returns Array of trimmed email addresses
 */
export const parseEmails = (emails: string): string[] => {
  return emails
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
};

/**
 * Extracts name from email address (text before @)
 * @param email - Email address
 * @returns Name extracted from email
 */
export const extractNameFromEmail = (email: string): string => {
  const namePart = email.split('@')[0];
  if (!namePart) {
    return 'Unknown';
  }
  // Convert to title case and replace common delimiters with spaces
  return namePart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Creates a new lead with the provided name and tenant ID
 * @param leadName - Name for the new lead
 * @param tenantId - Tenant ID
 * @returns Created lead
 */
export const createLeadForBulkCampaign = async (leadName: string, tenantId: string) => {
  try {
    const leadData: Omit<NewLead, 'tenantId'> = {
      name: leadName,
      url: 'https://placeholder.com', // Required field, using placeholder
      status: 'new',
    };

    // Create lead without owner (ownerId will be null)
    const createdLead = await createLead(tenantId, leadData, null as any, []); // No owner

    logger.info(`Created lead for bulk campaign`, {
      leadId: createdLead.id,
      leadName: leadName,
      tenantId: tenantId,
    });

    return createdLead;
  } catch (error) {
    logger.error('Error creating lead for bulk campaign:', error);
    throw error;
  }
};

/**
 * Creates contacts for the provided emails and triggers campaign creation
 * @param leadId - ID of the lead to associate contacts with
 * @param tenantId - Tenant ID
 * @param emails - Array of email addresses
 * @param campaignBody - Body message for campaigns
 * @returns Array of contact results
 */
export const createContactsAndCampaigns = async (
  leadId: string,
  tenantId: string,
  emails: string[],
  campaignBody: string
): Promise<ContactResult[]> => {
  const results: ContactResult[] = [];

  for (const email of emails) {
    const contactResult: ContactResult = {
      id: '',
      name: extractNameFromEmail(email),
      email: email,
      success: false,
    };

    try {
      // Create contact
      const contactData: Omit<NewLeadPointOfContact, 'leadId'> = {
        name: contactResult.name,
        email: email,
      };

      const createdContact = await createContact(tenantId, leadId, contactData);
      contactResult.id = createdContact.id;
      contactResult.success = true;

      logger.info(`Created contact for bulk campaign`, {
        contactId: createdContact.id,
        name: contactResult.name,
        email: email,
        leadId: leadId,
      });

      // Trigger campaign creation asynchronously
      try {
        await CampaignCreationPublisher.publish({
          tenantId: tenantId,
          leadId: leadId,
          contactId: createdContact.id,
          metadata: {
            automatedCreation: true,
            customBody: campaignBody,
            subject: 'test',
          },
        });

        logger.info(`Published campaign creation job for bulk campaign`, {
          contactId: createdContact.id,
          leadId: leadId,
          tenantId: tenantId,
        });
      } catch (campaignError) {
        logger.error('Error publishing campaign creation job:', campaignError);
        contactResult.error = `Contact created but campaign creation failed: ${
          campaignError instanceof Error ? campaignError.message : 'Unknown error'
        }`;
      }
    } catch (contactError) {
      logger.error('Error creating contact for bulk campaign:', contactError);
      contactResult.error = contactError instanceof Error ? contactError.message : 'Unknown error';
    }

    results.push(contactResult);
  }

  return results;
};

/**
 * Main service function to process bulk campaign creation
 * @param request - Bulk campaign request data
 * @returns Result of the bulk campaign creation
 */
export const processBulkCampaign = async (
  request: BulkCampaignRequest
): Promise<BulkCampaignResult> => {
  try {
    const { emails, leadName, tenantId, body } = request;

    // Parse emails
    const emailList = parseEmails(emails);
    if (emailList.length === 0) {
      throw new Error('No valid emails provided');
    }

    logger.info(`Starting bulk campaign creation`, {
      leadName: leadName,
      tenantId: tenantId,
      emailCount: emailList.length,
    });

    // Create lead
    const createdLead = await createLeadForBulkCampaign(leadName, tenantId);

    // Create contacts and trigger campaigns
    const contactResults = await createContactsAndCampaigns(
      createdLead.id,
      tenantId,
      emailList,
      body
    );

    // Calculate statistics
    const successfulContacts = contactResults.filter((result) => result.success).length;
    const successfulCampaigns = contactResults.filter(
      (result) => result.success && !result.error
    ).length;

    const result: BulkCampaignResult = {
      leadId: createdLead.id,
      leadName: leadName,
      tenantId: tenantId,
      totalEmails: emailList.length,
      successfulContacts: successfulContacts,
      successfulCampaigns: successfulCampaigns,
      contacts: contactResults,
    };

    logger.info(`Completed bulk campaign creation`, {
      leadId: createdLead.id,
      leadName: leadName,
      tenantId: tenantId,
      totalEmails: emailList.length,
      successfulContacts: successfulContacts,
      successfulCampaigns: successfulCampaigns,
    });

    return result;
  } catch (error) {
    logger.error('Error processing bulk campaign:', error);
    throw error;
  }
};
