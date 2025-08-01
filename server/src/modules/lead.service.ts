import { 
  leadRepository, 
  leadStatusRepository, 
  leadPointOfContactRepository,
  transactionRepository,
  userRepository
} from '@/repositories';
import {
  NewLead,
  NewLeadPointOfContact,
  Lead,
  LeadPointOfContact,
  NewLeadStatus,
  LeadStatus,
} from '../db/schema';
import { logger } from '../libs/logger';
import { LEAD_STATUS } from '../constants/leadStatus.constants';
import { storageService } from './storage/storage.service';
import { ProductsService } from './products.service';
import { attachProductsToLead } from './leadProduct.service';

// Helper function to transform lead data with signed URLs
const transformLeadWithSignedUrls = async (tenantId: string, lead: any) => {
  const storagePath = storageService.getTenantDomainLogoKey(tenantId, lead.url);
  const signedLogoUrl = await storageService.getSignedUrl(storagePath);

  return {
    ...lead,
    logo: signedLogoUrl,
  };
};

// Type definitions
export interface LeadWithPointOfContacts extends Lead {
  pointOfContacts: LeadPointOfContact[];
  statuses: LeadStatus[];
}

/**
 * Retrieves a list of leads for a specific tenant, with optional search functionality.
 */
export const getLeads = async (tenantId: string, searchQuery?: string, userId?: string) => {
  const leadResults = await leadRepository.findByTenantWithSearch(tenantId, searchQuery, userId);

  // Get statuses for all leads using repository
  const result = [];
  for (const lead of leadResults) {
    try {
      const statuses = await leadStatusRepository.findByLead(lead.id, tenantId, userId);
      result.push({
        ...lead,
        statuses,
      });
    } catch (error) {
      logger.warn(
        'Could not fetch lead statuses, this may be expected if migration has not been run yet:',
        error
      );
      result.push({
        ...lead,
        statuses: [],
      });
    }
  }

  return result;
};

/**
 * Creates a new lead for a specific tenant with optional point of contacts.
 */
export const createLead = async (
  tenantId: string,
  lead: Omit<NewLead, 'tenantId'>,
  ownerId: string,
  pointOfContacts?: Omit<NewLeadPointOfContact, 'leadId'>[],
  userId?: string
) => {
  const leadWithTenant: NewLead = {
    ...lead,
    tenantId,
    ownerId,
  };

  if (leadWithTenant.url) {
    leadWithTenant.url = leadWithTenant.url.cleanWebsiteUrl();
  }

  // Use transaction repository to create lead and point of contacts
  const result = await transactionRepository.createLeadWithContacts(
    leadWithTenant,
    pointOfContacts || [],
    tenantId,
    userId
  );

  // Transform lead with signed URLs
  const transformedLead = await transformLeadWithSignedUrls(tenantId, result.lead);

  // After the transaction is complete, attach default products to the lead
  try {
    const defaultProducts = await ProductsService.getDefaultProducts(tenantId, userId);
    if (defaultProducts.length > 0) {
      const defaultProductIds = defaultProducts.map((product) => product.id);
      await attachProductsToLead(result.lead.id, defaultProductIds, tenantId);
    }
  } catch (error) {
    logger.error('Failed to attach default products to new lead:', error);
  }

  return {
    ...transformedLead,
    pointOfContacts: result.contacts,
  };
};

/**
 * Retrieves a single lead by its ID with associated point of contacts.
 */
export const getLeadById = async (
  tenantId: string,
  id: string,
  userId?: string
): Promise<LeadWithPointOfContacts> => {
  try {
    // Get lead using repository
    const lead = await leadRepository.findById(id, tenantId, userId);

    if (!lead) {
      throw new Error(`Lead not found with ID: ${id}`);
    }

    // Get point of contacts for this lead
    const contacts = await leadPointOfContactRepository.findByLead(id, tenantId, userId);

    // Get statuses for this lead
    let statuses: LeadStatus[] = [];
    try {
      statuses = await leadStatusRepository.findByLead(id, tenantId, userId);
    } catch (error) {
      logger.warn(
        'Could not fetch lead statuses for lead detail, this may be expected if migration has not been run yet:',
        error
      );
      statuses = [];
    }

    // Transform lead with signed URLs
    const transformedLead = await transformLeadWithSignedUrls(tenantId, lead);

    return {
      ...transformedLead,
      pointOfContacts: contacts,
      statuses: statuses || [],
    } as LeadWithPointOfContacts;
  } catch (error) {
    logger.error('Error getting lead by ID:', error);
    throw error;
  }
};

/**
 * Updates a lead's data, ensuring it belongs to the specified tenant.
 */
export const updateLead = async (
  tenantId: string,
  id: string,
  leadData: Partial<Omit<NewLead, 'tenantId'>>,
  userId?: string
) => {
  return await leadRepository.update(id, leadData, tenantId, userId);
};

/**
 * Deletes a lead, ensuring it belongs to the specified tenant.
 */
export const deleteLead = async (tenantId: string, id: string, userId?: string) => {
  return await leadRepository.delete(id, tenantId, userId);
};

/**
 * Deletes multiple leads in bulk, ensuring they all belong to the specified tenant.
 */
export const bulkDeleteLeads = async (tenantId: string, ids: string[], userId?: string) => {
  return await transactionRepository.bulkDeleteLeads(ids, tenantId, userId);
};

/**
 * Updates the owner of a lead after validating user access.
 */
export const updateLeadOwner = async (
  tenantId: string,
  leadId: string,
  userId: string,
  requestingUserId?: string
) => {
  // Validate that the new owner has access to the tenant
  const newOwner = await userRepository.findById(userId, tenantId, requestingUserId);
  if (!newOwner) {
    throw new Error('New owner not found or does not have access to this tenant');
  }

  // Update the lead with the new owner
  const updatedLead = await leadRepository.updateOwner(leadId, userId, tenantId, requestingUserId);

  // Transform with signed URLs
  const transformedLead = await transformLeadWithSignedUrls(tenantId, updatedLead);
  return transformedLead;
};

/**
 * Creates a new point of contact for a lead.
 */
export const createLeadContact = async (
  tenantId: string,
  leadId: string,
  contactData: Omit<NewLeadPointOfContact, 'leadId'>,
  userId?: string
): Promise<LeadPointOfContact> => {
  const newContact: NewLeadPointOfContact = {
    ...contactData,
    leadId,
  };

  return await leadPointOfContactRepository.create(newContact, tenantId, userId);
};

/**
 * Updates a contact's manually reviewed status.
 */
export const updateContactManuallyReviewed = async (
  tenantId: string,
  leadId: string,
  contactId: string,
  manuallyReviewed: boolean,
  userId?: string
): Promise<LeadPointOfContact> => {
  return await leadPointOfContactRepository.updateManuallyReviewed(
    contactId,
    manuallyReviewed,
    tenantId,
    userId
  );
};

/**
 * Gets all statuses for a specific lead.
 */
export const getLeadStatuses = async (
  tenantId: string,
  leadId: string,
  userId?: string
): Promise<LeadStatus[]> => {
  return await leadStatusRepository.findByLead(leadId, tenantId, userId);
};

/**
 * Checks if a specific status exists for a lead.
 */
export const checkLeadHasStatus = async (
  tenantId: string,
  leadId: string,
  status: string,
  userId?: string
): Promise<boolean> => {
  const existingStatus = await leadStatusRepository.findByLeadAndStatus(
    leadId,
    status,
    tenantId,
    userId
  );
  return !!existingStatus;
};

/**
 * Adds a status to a lead if it doesn't already exist.
 */
export const addLeadStatus = async (
  tenantId: string,
  leadId: string,
  status: string,
  userId?: string
): Promise<void> => {
  const hasStatus = await checkLeadHasStatus(tenantId, leadId, status, userId);
  if (!hasStatus) {
    await leadStatusRepository.create({ leadId, status, tenantId }, tenantId, userId);
  }
};

/**
 * Creates default statuses for all leads without any status.
 */
export const createDefaultLeadStatuses = async (tenantId: string, userId?: string): Promise<void> => {
  // Get all leads for the tenant
  const leads = await leadRepository.findByTenant(tenantId, userId);
  
  for (const lead of leads) {
    const statuses = await leadStatusRepository.findByLead(lead.id, tenantId, userId);
    
    // If no statuses exist, add default "new" status
    if (statuses.length === 0) {
      await leadStatusRepository.create({
        leadId: lead.id,
        status: 'new',
        tenantId,
      }, tenantId, userId);
    }
  }
};

/**
 * Central method to update lead statuses by adding and removing specific statuses.
 */
export const updateLeadStatuses = async (
  tenantId: string,
  leadId: string,
  statusesToAdd: string[],
  statusesToRemove: string[],
  userId?: string
): Promise<LeadStatus[]> => {
  return await transactionRepository.updateLeadStatuses(
    leadId,
    statusesToAdd,
    statusesToRemove,
    tenantId,
    userId
  );
};