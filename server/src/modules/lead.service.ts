import { desc, or, ilike, inArray, eq, and } from 'drizzle-orm';
import db from '../libs/drizzleClient';
import {
  leads,
  NewLead,
  leadPointOfContacts,
  NewLeadPointOfContact,
  Lead,
  LeadPointOfContact,
} from '../db/schema';
import { logger } from '../libs/logger';
import { storageService } from './storage/storage.service';

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
 * @returns A promise that resolves to an array of lead objects.
 */
export const getLeads = async (tenantId: string, searchQuery?: string) => {
  // Build base query with tenant filter
  const baseWhere = eq(leads.tenantId, tenantId);

  // Add search functionality if searchQuery is provided
  let result;
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    result = await db
      .select()
      .from(leads)
      .where(and(baseWhere, or(ilike(leads.name, searchTerm), ilike(leads.url, searchTerm))))
      .orderBy(desc(leads.createdAt));
  } else {
    result = await db.select().from(leads).where(baseWhere).orderBy(desc(leads.createdAt));
  }

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

    // Transform lead with signed URLs
    const transformedLead = await transformLeadWithSignedUrls(tenantId, createdLead);

    return {
      ...transformedLead,
      pointOfContacts: createdContacts,
    };
  });

  return result;
};

/**
 * Retrieves a single lead by its ID with associated point of contacts, ensuring it belongs to the specified tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param id - The ID of the lead to retrieve.
 * @returns A promise that resolves to the lead object with point of contacts, or undefined if not found.
 */
type LeadWithPointOfContacts = Lead & { pointOfContacts: LeadPointOfContact[] };
export const getLeadById = async (
  tenantId: string,
  id: string
): Promise<LeadWithPointOfContacts> => {
  try {
    const lead = await db
      .select()
      .from(leads)
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

    // Transform lead with signed URLs using existing function
    const transformedLead = await transformLeadWithSignedUrls(tenantId, leadData);

    return {
      ...transformedLead,
      pointOfContacts: contacts,
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
