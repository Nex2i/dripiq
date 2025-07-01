import { desc, or, ilike, inArray, eq, and } from 'drizzle-orm';
import db from '../libs/drizzleClient';
import { leads, NewLead } from '../db/schema';

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

export const createLead = async (tenantId: string, lead: Omit<NewLead, 'tenantId'>) => {
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  // Add tenantId to the lead data
  const leadWithTenant: NewLead = {
    ...lead,
    tenantId,
  };

  const result = await db.insert(leads).values(leadWithTenant).returning();
  return result[0];
};

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

export const deleteLead = async (tenantId: string, id: string) => {
  // Note: Tenant validation is now handled in authentication plugin to avoid redundant DB queries
  // validateUserTenantAccess is skipped here since auth plugin already verified tenant access

  const result = await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .returning();
  return result[0];
};

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
