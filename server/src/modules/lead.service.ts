import { desc, or, ilike, inArray, eq, and } from 'drizzle-orm';
import db from '../libs/drizzleClient';
import { leads, NewLead } from '../db/schema';

/**
 * Retrieves a list of leads for a specific tenant, with optional search functionality.
 * @param tenantId - The ID of the tenant to retrieve leads for.
 * @param searchQuery - An optional string to search for in the lead's name, email, company, or phone number.
 * @returns A promise that resolves to an array of lead objects.
 */
export const getLeads = async (tenantId: string, searchQuery?: string) => {
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  // Build base query with tenant filter
  const baseWhere = eq(leads.tenantId, tenantId);

  // Add search functionality if searchQuery is provided
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    const result = await db
      .select()
      .from(leads)
      .where(
        and(
          baseWhere,
          or(
            ilike(leads.name, searchTerm),
            ilike(leads.email, searchTerm),
            ilike(leads.company, searchTerm),
            ilike(leads.phone, searchTerm)
          )
        )
      )
      .orderBy(desc(leads.createdAt));
    return result;
  }

  const result = await db.select().from(leads).where(baseWhere).orderBy(desc(leads.createdAt));
  return result;
};

/**
 * Creates a new lead for a specific tenant.
 * @param tenantId - The ID of the tenant the lead will belong to.
 * @param lead - The data for the new lead.
 * @returns A promise that resolves to the newly created lead object.
 */
export const createLead = async (tenantId: string, lead: Omit<NewLead, 'tenantId'>) => {
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  // Add tenantId to the lead data
  const leadWithTenant: NewLead = {
    ...lead,
    tenantId,
  };

  if (leadWithTenant.url) {
    leadWithTenant.url = leadWithTenant.url.cleanWebsiteUrl();
  }

  if (leadWithTenant.company) {
    leadWithTenant.company = leadWithTenant.company.toLowerCase();
  }

  const result = await db.insert(leads).values(leadWithTenant).returning();
  return result[0];
};

/**
 * Retrieves a single lead by its ID, ensuring it belongs to the specified tenant.
 * @param tenantId - The ID of the tenant the lead belongs to.
 * @param id - The ID of the lead to retrieve.
 * @returns A promise that resolves to the lead object, or undefined if not found.
 */
export const getLeadById = async (tenantId: string, id: string) => {
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  const result = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .limit(1);
  return result[0];
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
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

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
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  const result = await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .returning();
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

  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  const result = await db
    .delete(leads)
    .where(and(inArray(leads.id, ids), eq(leads.tenantId, tenantId)))
    .returning();
  return result;
};
