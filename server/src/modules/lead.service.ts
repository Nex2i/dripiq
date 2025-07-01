import db from '../libs/drizzleClient';
import { leads, NewLead } from '../db/schema';
import { desc } from 'drizzle-orm';

export const getLeads = async () => {
  const result = await db.select().from(leads).orderBy(desc(leads.createdAt));
  return result;
};

export const createLead = async (lead: NewLead) => {
  const result = await db.insert(leads).values(lead).returning();
  return result[0];
};
