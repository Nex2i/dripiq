import '../extensions';
import {
  leadRepository,
  leadPointOfContactRepository,
  leadStatusRepository,
  leadTransactionRepository,
  repositories,
} from '../repositories';
import { NewLead, NewLeadPointOfContact, Lead, LeadPointOfContact, LeadStatus } from '../db/schema';
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

/**
 * Retrieves a list of leads for a specific tenant, with optional search functionality.
 * @param tenantId - The ID of the tenant to retrieve leads for.
 * @param searchQuery - An optional string to search for in the lead's name, email, company, or phone number.
 * @returns A promise that resolves to an array of lead objects with owner information.
 */
export const getLeads = async (tenantId: string, searchQuery?: string) => {
  // Use repository to get leads with search functionality
  const leadResults = await leadRepository.findWithSearch(tenantId, {
    searchQuery,
  });

  // Get statuses for all leads in a single query for better performance
  const leadIds = leadResults.map((lead) => lead.id);
  let allStatuses: any[] = [];

  if (leadIds.length > 0) {
    try {
      allStatuses = await leadStatusRepository.findByLeadIdsForTenant(leadIds, tenantId);
    } catch (error) {
      // If leadStatuses table doesn't exist yet (migration not run), continue without statuses
      logger.warn(
        'Could not fetch lead statuses, this may be expected if migration has not been run yet:',
        error
      );
      allStatuses = [];
    }
  }

  // Group statuses by leadId
  const statusesByLeadId = allStatuses.reduce(
    (acc, status) => {
      if (!acc[status.leadId]) {
        acc[status.leadId] = [];
      }
      acc[status.leadId].push(status);
      return acc;
    },
    {} as Record<string, any[]>
  );

  // Add statuses to each lead
  const result = leadResults.map((lead) => ({
    ...lead,
    statuses: statusesByLeadId[lead.id] || [],
  }));

  return result;
};

/**
 * Creates a new lead for a specific tenant with optional point of contacts.
 * @param tenantId - The ID of the tenant the lead will belong to.
 * @param lead - The data for the new lead.
 * @param ownerId - The ID of the user who will own this lead.
 * @param pointOfContacts - Optional array of point of contacts to create for the lead.
 * @returns A promise that resolves to the newly created lead object with point of contacts.
 */
export const createLead = async (
  tenantId: string,
  lead: Omit<NewLead, 'tenantId'>,
  ownerId: string,
  pointOfContacts?: Omit<NewLeadPointOfContact, 'leadId'>[]
) => {
  // Add ownerId to the lead data
  const leadWithOwner = {
    ...lead,
    ownerId,
  };

  if (leadWithOwner.url) {
    leadWithOwner.url = leadWithOwner.url.cleanWebsiteUrl();
  }

  // Use transaction repository to create lead with contacts and status
  const result = await leadTransactionRepository.createLeadWithContacts(tenantId, {
    lead: leadWithOwner,
    contacts: pointOfContacts || [],
    statuses: [LEAD_STATUS.UNPROCESSED],
  });

  // Transform lead with signed URLs
  const transformedLead = await transformLeadWithSignedUrls(tenantId, result.lead);

  const finalResult = {
    ...transformedLead,
    pointOfContacts: result.contacts,
    statuses: result.statuses,
  };

  // After the transaction is complete, attach default products to the lead
  try {
    const defaultProducts = await ProductsService.getDefaultProducts(tenantId);
    if (defaultProducts.length > 0) {
      const defaultProductIds = defaultProducts.map((product) => product.id);
      await attachProductsToLead(finalResult.id, defaultProductIds, tenantId);
    }
  } catch (error) {
    // Log the error but don't fail the lead creation if product attachment fails
    logger.error('Failed to attach default products to new lead:', error);
  }

  return finalResult;
};

/**
 * Retrieves a single lead by its ID with associated point of contacts, ensuring it belongs to the specified tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param id - The ID of the lead to retrieve.
 * @returns A promise that resolves to the lead object with point of contacts, or undefined if not found.
 */
type LeadWithPointOfContacts = Lead & {
  pointOfContacts: LeadPointOfContact[];
  statuses: LeadStatus[];
};
export const getLeadById = async (
  tenantId: string,
  id: string
): Promise<LeadWithPointOfContacts> => {
  try {
    // Get lead with owner information using repository
    const leadData = await leadRepository.findById(id);

    // Get point of contacts for this lead
    const contacts = await leadPointOfContactRepository.findByLeadId(id);

    // Get statuses for this lead (handle case where table doesn't exist yet)
    let statuses: any[] = [];
    try {
      statuses = await leadStatusRepository.findByLeadIdForTenant(id, tenantId);
    } catch (error) {
      // If leadStatuses table doesn't exist yet (migration not run), continue without statuses
      logger.warn(
        'Could not fetch lead statuses for lead detail, this may be expected if migration has not been run yet:',
        error
      );
      statuses = [];
    }

    // Transform lead with signed URLs using existing function
    const transformedLead = await transformLeadWithSignedUrls(tenantId, leadData);

    return {
      ...transformedLead,
      pointOfContacts: contacts,
      statuses: statuses || [], // Ensure statuses is always an array
    } as LeadWithPointOfContacts;
  } catch (error) {
    logger.error('Error getting lead by ID:', error);
    throw error;
  }
};

/**
 * Updates a lead's data, ensuring it belongs to the specified tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param id - The ID of the lead to update.
 * @param leadData - An object containing the fields to update.
 * @returns A promise that resolves to the updated lead object.
 */
export const updateLead = async (
  tenantId: string,
  id: string,
  leadData: Partial<Omit<NewLead, 'tenantId'>>
) => {
  const result = await leadRepository.updateByIdForTenant(id, tenantId, leadData);
  return result;
};

/**
 * Deletes a lead, ensuring it belongs to the specified tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param id - The ID of the lead to delete.
 * @returns A promise that resolves to the deleted lead object.
 */
export const deleteLead = async (tenantId: string, id: string) => {
  const result = await leadTransactionRepository.deleteLeadWithAllData(id, tenantId);
  return result.lead;
};

/**
 * Deletes multiple leads in bulk, ensuring they all belong to the specified tenant.
 * @param tenantId - The ID of the tenant the leads belong to.
 * @param ids - An array of lead IDs to delete.
 * @returns A promise that resolves to an array of the deleted lead objects.
 */
export const bulkDeleteLeads = async (tenantId: string, ids: string[]) => {
  if (ids.length === 0) {
    return [];
  }

  const result = await leadTransactionRepository.deleteMultipleLeadsWithAllData(ids, tenantId);
  return result.leadsDeleted;
};

/**
 * Assigns an owner to a lead, ensuring both the lead and user belong to the same tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param leadId - The ID of the lead to assign an owner to.
 * @param userId - The ID of the user to assign as owner.
 * @returns A promise that resolves to the updated lead object with owner information.
 */
export const assignLeadOwner = async (tenantId: string, leadId: string, userId: string) => {
  try {
    // First, verify that the lead exists and belongs to the tenant
    const lead = await leadRepository.findByIdForTenant(leadId, tenantId);
    if (!lead) {
      throw new Error(`Lead not found with ID: ${leadId} in tenant: ${tenantId}`);
    }

    // Then, verify that the user exists and belongs to the same tenant
    const userTenant = await repositories.userTenant.findByUserIdForTenant(userId, tenantId);
    if (!userTenant) {
      throw new Error(`User not found with ID: ${userId} in tenant: ${tenantId}`);
    }

    // Update the lead with the new owner
    const result = await leadRepository.assignToOwnerForTenant(leadId, tenantId, userId);
    if (!result) {
      throw new Error('Failed to update lead owner');
    }

    // Get the updated lead with owner information
    const updatedLeadResults = await leadRepository.findWithSearch(tenantId, {});
    const updatedLeadWithOwner = updatedLeadResults.find((lead) => lead.id === leadId);

    if (!updatedLeadWithOwner) {
      throw new Error('Failed to retrieve updated lead with owner information');
    }

    // Transform lead with signed URLs
    const transformedLead = await transformLeadWithSignedUrls(tenantId, updatedLeadWithOwner);

    return transformedLead;
  } catch (error) {
    logger.error('Error assigning lead owner:', error);
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
    // Verify the lead exists and belongs to the tenant
    const lead = await getLeadById(tenantId, leadId);
    if (!lead) {
      throw new Error(`Lead not found or does not belong to tenant: ${leadId}`);
    }

    // Create the contact using repository
    const createdContact = await leadPointOfContactRepository.createForLeadAndTenant(
      leadId,
      tenantId,
      contactData
    );

    logger.info(`Created contact ${createdContact.name} for lead ${leadId}`);
    return createdContact;
  } catch (error) {
    logger.error('Error creating contact:', error);
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
    // Verify the lead exists and belongs to the tenant
    const lead = await getLeadById(tenantId, leadId);
    if (!lead) {
      throw new Error(`Lead not found or does not belong to tenant: ${leadId}`);
    }

    // Verify the contact exists and belongs to the tenant/lead
    const contact = await leadPointOfContactRepository.findByIdForTenant(contactId, tenantId);
    if (!contact || contact.leadId !== leadId) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Update the contact's manually reviewed status
    const updatedContact = await leadPointOfContactRepository.updateByIdForTenant(
      contactId,
      tenantId,
      { manuallyReviewed }
    );

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

/**
 * Get all statuses for a lead
 * @param tenantId - The ID of the tenant
 * @param leadId - The ID of the lead
 * @returns A promise that resolves to an array of lead statuses
 */
export const getLeadStatuses = async (tenantId: string, leadId: string): Promise<LeadStatus[]> => {
  try {
    // Verify the lead exists and belongs to the tenant
    const lead = await getLeadById(tenantId, leadId);
    if (!lead) {
      throw new Error(`Lead not found or does not belong to tenant: ${leadId}`);
    }

    const statuses = await leadStatusRepository.findByLeadIdForTenant(leadId, tenantId);
    return statuses;
  } catch (error) {
    logger.error('Error getting lead statuses:', error);
    throw error;
  }
};

/**
 * Check if a lead has a specific status
 * @param tenantId - The ID of the tenant
 * @param leadId - The ID of the lead
 * @param status - The status to check for
 * @returns A promise that resolves to a boolean indicating if the status exists
 */
export const hasStatus = async (
  tenantId: string,
  leadId: string,
  status: LeadStatus['status']
): Promise<boolean> => {
  try {
    const exists = await leadStatusRepository.statusExistsForLeadAndTenant(
      leadId,
      status,
      tenantId
    );
    return exists;
  } catch (error) {
    logger.error('Error checking lead status:', error);
    throw error;
  }
};

/**
 * Ensure a lead has the default "Unprocessed" status if no statuses exist
 * @param tenantId - The ID of the tenant
 * @param leadId - The ID of the lead
 * @returns A promise that resolves when the default status is ensured
 */
export const ensureDefaultStatus = async (tenantId: string, leadId: string): Promise<void> => {
  try {
    const existingStatuses = await leadStatusRepository.findByLeadIdForTenant(leadId, tenantId);

    if (existingStatuses.length === 0) {
      await leadStatusRepository.createForTenant(tenantId, {
        leadId,
        status: LEAD_STATUS.UNPROCESSED,
      });

      logger.info(`Added default "Unprocessed" status to lead ${leadId}`);
    }
  } catch (error) {
    logger.error('Error ensuring default status:', error);
    // Don't throw error to avoid breaking lead operations if status table doesn't exist yet
    logger.warn(
      `Could not ensure default status for lead ${leadId}, this may be expected if migration hasn't run yet`
    );
  }
};

/**
 * Helper function to add default statuses to all leads that don't have any
 * This can be used for data migration or fixing existing leads
 * @param tenantId - The ID of the tenant
 * @returns A promise that resolves when all leads have default statuses
 */
export const ensureAllLeadsHaveDefaultStatus = async (tenantId: string): Promise<void> => {
  try {
    // Get all leads for the tenant
    const allLeads = await leadRepository.findAllForTenant(tenantId);

    // Get all existing statuses for this tenant
    const existingStatuses = await leadStatusRepository.findAllForTenant(tenantId);

    const leadsWithStatuses = new Set(existingStatuses.map((s) => s.leadId));

    // Find leads without any status
    const leadsWithoutStatus = allLeads.filter((lead) => !leadsWithStatuses.has(lead.id));

    if (leadsWithoutStatus.length > 0) {
      // Create default statuses for leads without any
      const statusesToCreate = leadsWithoutStatus.map(() => LEAD_STATUS.UNPROCESSED);
      const leadIds = leadsWithoutStatus.map((lead) => lead.id);

      // Create statuses for each lead
      for (let i = 0; i < leadIds.length; i++) {
        const leadId = leadIds[i];
        const status = statusesToCreate[i];

        if (leadId && status) {
          await leadStatusRepository.createForTenant(tenantId, {
            leadId,
            status,
          });
        }
      }

      logger.info(`Added default "Unprocessed" status to ${leadsWithoutStatus.length} leads`);
    }
  } catch (error) {
    logger.error('Error ensuring all leads have default status:', error);
    // Don't throw to avoid breaking the application
  }
};

/**
 * Central method to update lead statuses by adding and removing specific statuses
 * @param tenantId - The ID of the tenant
 * @param leadId - The ID of the lead
 * @param statusesToAdd - Array of statuses to add
 * @param statusesToRemove - Array of statuses to remove
 * @returns A promise that resolves to the updated list of statuses
 */
export const updateLeadStatuses = async (
  tenantId: string,
  leadId: string,
  statusesToAdd: LeadStatus['status'][] = [],
  statusesToRemove: LeadStatus['status'][] = []
): Promise<LeadStatus[]> => {
  try {
    // Verify the lead exists and belongs to the tenant
    const lead = await getLeadById(tenantId, leadId);
    if (!lead) {
      throw new Error(`Lead not found or does not belong to tenant: ${leadId}`);
    }

    // Get current statuses
    const currentStatuses = await leadStatusRepository.findByLeadIdForTenant(leadId, tenantId);

    // Remove specified statuses
    for (const status of statusesToRemove) {
      await leadStatusRepository.deleteByLeadAndStatusForTenant(leadId, status, tenantId);
    }

    // Add new statuses (only if they don't already exist)
    for (const status of statusesToAdd) {
      const exists = currentStatuses.some((s) => s.status === status);
      if (!exists && !statusesToRemove.includes(status)) {
        await leadStatusRepository.createIfNotExistsForTenant(leadId, status, tenantId);
      }
    }

    // Get updated statuses after changes
    let updatedStatuses = await leadStatusRepository.findByLeadIdForTenant(leadId, tenantId);

    // Ensure at least one status exists (add "Unprocessed" if none exist)
    if (updatedStatuses.length === 0) {
      await leadStatusRepository.createForTenant(tenantId, {
        leadId,
        status: LEAD_STATUS.UNPROCESSED,
      });

      // Get the final statuses including the default one
      updatedStatuses = await leadStatusRepository.findByLeadIdForTenant(leadId, tenantId);
    }

    logger.info(
      `Updated statuses for lead ${leadId}: added [${statusesToAdd.join(', ')}], removed [${statusesToRemove.join(', ')}]`
    );

    return updatedStatuses;
  } catch (error) {
    logger.error('Error updating lead statuses:', error);
    throw error;
  }
};
