import db from '../libs/drizzleClient';
import { leads, NewLead } from '../db/schema';

export const getLeads = async () => {
  const result = await db.select().from(leads);
  return result;
};

export const createLead = async (lead: NewLead) => {
  const result = await db.insert(leads).values(lead).returning();
  return result[0];
};
