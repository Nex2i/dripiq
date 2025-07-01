import db from '../libs/drizzleClient';
import { leads, NewLead } from '../db/schema';
import { desc, or, ilike, inArray, eq } from 'drizzle-orm';

export const getLeads = async (searchQuery?: string) => {
  // Add search functionality if searchQuery is provided
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    const result = await db
      .select()
      .from(leads)
      .where(
        or(
          ilike(leads.name, searchTerm),
          ilike(leads.email, searchTerm),
          ilike(leads.company, searchTerm),
          ilike(leads.phone, searchTerm)
        )
      )
      .orderBy(desc(leads.createdAt));
    return result;
  }

  const result = await db.select().from(leads).orderBy(desc(leads.createdAt));
  return result;
};

export const createLead = async (lead: NewLead) => {
  const result = await db.insert(leads).values(lead).returning();
  return result[0];
};

export const updateLead = async (id: string, leadData: Partial<NewLead>) => {
  const result = await db
    .update(leads)
    .set({ ...leadData, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  return result[0];
};

export const deleteLead = async (id: string) => {
  const result = await db.delete(leads).where(eq(leads.id, id)).returning();
  return result[0];
};

export const bulkDeleteLeads = async (ids: string[]) => {
  if (ids.length === 0) {
    return [];
  }

  const result = await db.delete(leads).where(inArray(leads.id, ids)).returning();
  return result;
};
