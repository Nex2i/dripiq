import { desc, or, ilike, inArray, eq, and } from 'drizzle-orm';
import db from '../libs/drizzleClient';
import {
  leads,
  NewLead,
  leadPointOfContacts,
  NewLeadPointOfContact,
  Lead,
  LeadPointOfContact,
  leadStatuses,
  NewLeadStatus,
  LeadStatus,
  userTenants,
  users,
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

/**
 * Retrieves a list of leads for a specific tenant, with optional search functionality.
 * @param tenantId - The ID of the tenant to retrieve leads for.
 * @param searchQuery - An optional string to search for in the lead's name, email, company, or phone number.
 * @returns A promise that resolves to an array of lead objects with owner information.
 */
export const getLeads = async (tenantId: string, searchQuery?: string) => {
  // Build base query with tenant filter
  const baseWhere = eq(leads.tenantId, tenantId);

  // Add search functionality if searchQuery is provided
  let leadResults;
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    leadResults = await db
      .select({
        // Lead fields
        id: leads.id,
        name: leads.name,
        url: leads.url,
        status: leads.status,
        summary: leads.summary,
        products: leads.products,
        services: leads.services,
        differentiators: leads.differentiators,
        targetMarket: leads.targetMarket,
        tone: leads.tone,
        brandColors: leads.brandColors,
        primaryContactId: leads.primaryContactId,
        ownerId: leads.ownerId,
        tenantId: leads.tenantId,
        siteEmbeddingDomainId: leads.siteEmbeddingDomainId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(and(baseWhere, or(ilike(leads.name, searchTerm), ilike(leads.url, searchTerm))))
      .orderBy(desc(leads.createdAt));
  } else {
    leadResults = await db
      .select({
        // Lead fields
        id: leads.id,
        name: leads.name,
        url: leads.url,
        status: leads.status,
        summary: leads.summary,
        products: leads.products,
        services: leads.services,
        differentiators: leads.differentiators,
        targetMarket: leads.targetMarket,
        tone: leads.tone,
        brandColors: leads.brandColors,
        primaryContactId: leads.primaryContactId,
        ownerId: leads.ownerId,
        tenantId: leads.tenantId,
        siteEmbeddingDomainId: leads.siteEmbeddingDomainId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(baseWhere)
      .orderBy(desc(leads.createdAt));
  }

  // Get statuses for all leads in a single query for better performance
  const leadIds = leadResults.map((lead) => lead.id);
  let allStatuses: any[] = [];

  if (leadIds.length > 0) {
    try {
      allStatuses = await db
        .select()
        .from(leadStatuses)
        .where(and(inArray(leadStatuses.leadId, leadIds), eq(leadStatuses.tenantId, tenantId)))
        .orderBy(leadStatuses.createdAt);
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
 * @param pointOfContacts - Optional array of point of contacts to create for the lead.
 * @returns A promise that resolves to the newly created lead object with point of contacts.
 */
export const createLead = async (
  tenantId: string,
  lead: Omit<NewLead, 'tenantId'>,
  pointOfContacts?: Omit<NewLeadPointOfContact, 'leadId'>[]
) => {
  // Add tenantId to the lead data
  const leadWithTenant: NewLead = {
    ...lead,
    tenantId,
  };

  if (leadWithTenant.url) {
    leadWithTenant.url = leadWithTenant.url.cleanWebsiteUrl();
  }

  // Use transaction to create lead and point of contacts
  const result = await db.transaction(async (tx) => {
    // Create the lead first
    const createdLeads = await tx.insert(leads).values(leadWithTenant).returning();
    let createdLead = createdLeads[0];

    if (!createdLead || !createdLead.id) {
      throw new Error('Failed to create lead');
    }

    // Create point of contacts if provided
    let createdContacts: any[] = [];
    if (pointOfContacts && pointOfContacts.length > 0) {
      const contactsWithLeadId = pointOfContacts.map((contact) => ({
        ...contact,
        leadId: createdLead!.id,
      }));

      createdContacts = await tx.insert(leadPointOfContacts).values(contactsWithLeadId).returning();

      // Set the first contact as primary contact if no primary contact is set
      if (createdContacts.length > 0 && !createdLead.primaryContactId) {
        const updatedLeads = await tx
          .update(leads)
          .set({ primaryContactId: createdContacts[0].id })
          .where(eq(leads.id, createdLead.id))
          .returning();

        createdLead = updatedLeads[0]!;
      }
    }

    // Create default "Unprocessed" status for the lead
    await tx.insert(leadStatuses).values({
      leadId: createdLead.id,
      tenantId,
      status: LEAD_STATUS.UNPROCESSED,
    });

    // Transform lead with signed URLs
    const transformedLead = await transformLeadWithSignedUrls(tenantId, createdLead);

    return {
      ...transformedLead,
      pointOfContacts: createdContacts,
    };
  });

  // After the transaction is complete, attach default products to the lead
  try {
    const defaultProducts = await ProductsService.getDefaultProducts(tenantId);
    if (defaultProducts.length > 0) {
      const defaultProductIds = defaultProducts.map((product) => product.id);
      await attachProductsToLead(result.id, defaultProductIds, tenantId);
    }
  } catch (error) {
    // Log the error but don't fail the lead creation if product attachment fails
    logger.error('Failed to attach default products to new lead:', error);
  }

  return result;
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
    const lead = await db
      .select({
        // Lead fields
        id: leads.id,
        name: leads.name,
        url: leads.url,
        status: leads.status,
        summary: leads.summary,
        products: leads.products,
        services: leads.services,
        differentiators: leads.differentiators,
        targetMarket: leads.targetMarket,
        tone: leads.tone,
        brandColors: leads.brandColors,
        primaryContactId: leads.primaryContactId,
        ownerId: leads.ownerId,
        tenantId: leads.tenantId,
        siteEmbeddingDomainId: leads.siteEmbeddingDomainId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        // Owner fields (nullable)
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(leads)
      .leftJoin(users, eq(leads.ownerId, users.id))
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (lead.length === 0) {
      throw new Error(`Lead not found with ID: ${id}`);
    }

    const leadData = lead[0];

    // Get point of contacts for this lead
    const contacts = await db
      .select()
      .from(leadPointOfContacts)
      .where(eq(leadPointOfContacts.leadId, id))
      .orderBy(leadPointOfContacts.createdAt);

    // Get statuses for this lead (handle case where table doesn't exist yet)
    let statuses: any[] = [];
    try {
      statuses = await db
        .select()
        .from(leadStatuses)
        .where(and(eq(leadStatuses.leadId, id), eq(leadStatuses.tenantId, tenantId)))
        .orderBy(leadStatuses.createdAt);
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
  const result = await db
    .update(leads)
    .set({ ...leadData, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .returning();
  return result[0];
};

/**
 * Deletes a lead, ensuring it belongs to the specified tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param id - The ID of the lead to delete.
 * @returns A promise that resolves to the deleted lead object.
 */
export const deleteLead = async (tenantId: string, id: string) => {
  const result = await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .returning();

  if (result.length === 0) {
    return null;
  }

  return result[0];
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

  const result = await db
    .delete(leads)
    .where(and(inArray(leads.id, ids), eq(leads.tenantId, tenantId)))
    .returning();

  return result;
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
    const lead = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (lead.length === 0) {
      throw new Error(`Lead not found with ID: ${leadId} in tenant: ${tenantId}`);
    }

    // Then, verify that the user exists and belongs to the same tenant
    const userTenant = await db
      .select()
      .from(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .limit(1);

    if (userTenant.length === 0) {
      throw new Error(`User not found with ID: ${userId} in tenant: ${tenantId}`);
    }

    // Update the lead with the new owner
    const result = await db
      .update(leads)
      .set({ ownerId: userId, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    if (result.length === 0) {
      throw new Error('Failed to update lead owner');
    }

    // Get the updated lead with owner information (similar to getLeads)
    const updatedLeadWithOwner = await db
      .select({
        // Lead fields
        id: leads.id,
        name: leads.name,
        url: leads.url,
        status: leads.status,
        summary: leads.summary,
        products: leads.products,
        services: leads.services,
        differentiators: leads.differentiators,
        targetMarket: leads.targetMarket,
        tone: leads.tone,
        brandColors: leads.brandColors,
        primaryContactId: leads.primaryContactId,
        ownerId: leads.ownerId,
        tenantId: leads.tenantId,
        siteEmbeddingDomainId: leads.siteEmbeddingDomainId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        // Owner fields (nullable)
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(leads)
      .leftJoin(users, eq(leads.ownerId, users.id))
      .where(eq(leads.id, leadId))
      .limit(1);

    if (updatedLeadWithOwner.length === 0) {
      throw new Error('Failed to retrieve updated lead with owner information');
    }

    // Transform lead with signed URLs
    const transformedLead = await transformLeadWithSignedUrls(tenantId, updatedLeadWithOwner[0]);

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

    // Create the contact
    const newContact: NewLeadPointOfContact = {
      ...contactData,
      leadId,
    };

    const [createdContact] = await db.insert(leadPointOfContacts).values(newContact).returning();

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

    // Verify the contact exists and belongs to the lead
    const contact = await db
      .select()
      .from(leadPointOfContacts)
      .where(and(eq(leadPointOfContacts.id, contactId), eq(leadPointOfContacts.leadId, leadId)))
      .limit(1);

    if (contact.length === 0) {
      throw new Error(`Contact not found with ID: ${contactId} for lead: ${leadId}`);
    }

    // Update the contact's manually reviewed status
    const [updatedContact] = await db
      .update(leadPointOfContacts)
      .set({
        manuallyReviewed: manuallyReviewed,
        updatedAt: new Date(),
      })
      .where(eq(leadPointOfContacts.id, contactId))
      .returning();

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

    const statuses = await db
      .select()
      .from(leadStatuses)
      .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
      .orderBy(leadStatuses.createdAt);

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
    const result = await db
      .select()
      .from(leadStatuses)
      .where(
        and(
          eq(leadStatuses.leadId, leadId),
          eq(leadStatuses.tenantId, tenantId),
          eq(leadStatuses.status, status)
        )
      )
      .limit(1);

    return result.length > 0;
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
    const existingStatuses = await db
      .select()
      .from(leadStatuses)
      .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
      .limit(1);

    if (existingStatuses.length === 0) {
      await db.insert(leadStatuses).values({
        leadId,
        tenantId,
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
    const allLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.tenantId, tenantId));

    // Get all existing statuses for this tenant
    const existingStatuses = await db
      .select({ leadId: leadStatuses.leadId })
      .from(leadStatuses)
      .where(eq(leadStatuses.tenantId, tenantId));

    const leadsWithStatuses = new Set(existingStatuses.map((s) => s.leadId));

    // Find leads without any status
    const leadsWithoutStatus = allLeads.filter((lead) => !leadsWithStatuses.has(lead.id));

    if (leadsWithoutStatus.length > 0) {
      // Create default statuses for leads without any
      const defaultStatuses = leadsWithoutStatus.map((lead) => ({
        leadId: lead.id,
        tenantId,
        status: LEAD_STATUS.UNPROCESSED,
      }));

      await db.insert(leadStatuses).values(defaultStatuses);
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

    // Use transaction to ensure consistency
    const result = await db.transaction(async (tx) => {
      // Get current statuses
      const currentStatuses = await tx
        .select()
        .from(leadStatuses)
        .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)));

      // Remove specified statuses
      if (statusesToRemove.length > 0) {
        await tx
          .delete(leadStatuses)
          .where(
            and(
              eq(leadStatuses.leadId, leadId),
              eq(leadStatuses.tenantId, tenantId),
              inArray(leadStatuses.status, statusesToRemove)
            )
          );
      }

      // Add new statuses (only if they don't already exist)
      const statusesToInsert: NewLeadStatus[] = [];
      for (const status of statusesToAdd) {
        const exists = currentStatuses.some((s) => s.status === status);
        if (!exists && !statusesToRemove.includes(status)) {
          statusesToInsert.push({
            leadId,
            tenantId,
            status,
          });
        }
      }

      if (statusesToInsert.length > 0) {
        await tx.insert(leadStatuses).values(statusesToInsert);
      }

      // Get updated statuses after changes
      const updatedStatuses = await tx
        .select()
        .from(leadStatuses)
        .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
        .orderBy(leadStatuses.createdAt);

      // Ensure at least one status exists (add "Unprocessed" if none exist)
      if (updatedStatuses.length === 0) {
        await tx.insert(leadStatuses).values({
          leadId,
          tenantId,
          status: LEAD_STATUS.UNPROCESSED,
        });

        // Get the final statuses including the default one
        return await tx
          .select()
          .from(leadStatuses)
          .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
          .orderBy(leadStatuses.createdAt);
      }

      return updatedStatuses;
    });

    logger.info(
      `Updated statuses for lead ${leadId}: added [${statusesToAdd.join(', ')}], removed [${statusesToRemove.join(', ')}]`
    );

    return result;
  } catch (error) {
    logger.error('Error updating lead statuses:', error);
    throw error;
  }
};
