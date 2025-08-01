import { db } from '@/db';
import { 
  leads, 
  leadPointOfContacts, 
  leadStatuses,
  NewLead, 
  NewLeadPointOfContact, 
  NewLeadStatus,
  Lead,
  LeadPointOfContact,
  LeadStatus
} from '@/db/schema';

export interface CreateLeadWithContactsData {
  lead: Omit<NewLead, 'tenantId'>;
  contacts: Omit<NewLeadPointOfContact, 'leadId'>[];
  statuses?: string[];
}

export interface LeadCreationResult {
  lead: Lead;
  contacts: LeadPointOfContact[];
  statuses: LeadStatus[];
}

export interface BulkLeadCreationData {
  leadsWithContacts: CreateLeadWithContactsData[];
  defaultStatuses: string[];
}

export interface BulkLeadCreationResult {
  results: LeadCreationResult[];
  errors: { index: number; error: string }[];
}

export class LeadTransactionRepository {
  /**
   * Create a lead with contacts and statuses in a single transaction
   */
  async createLeadWithContacts(
    tenantId: string,
    data: CreateLeadWithContactsData
  ): Promise<LeadCreationResult> {
    return await db.transaction(async (tx) => {
      // Create the lead
      const leadData = { ...data.lead, tenantId };
      const [createdLead] = await tx.insert(leads).values(leadData).returning();

      // Create contacts if any
      let createdContacts: LeadPointOfContact[] = [];
      if (data.contacts.length > 0) {
        const contactsWithLeadId = data.contacts.map(contact => ({
          ...contact,
          leadId: createdLead.id,
        }));
        createdContacts = await tx.insert(leadPointOfContacts).values(contactsWithLeadId).returning();
      }

      // Set primary contact if there's exactly one contact
      if (createdContacts.length === 1) {
        const [updatedLead] = await tx
          .update(leads)
          .set({ primaryContactId: createdContacts[0].id })
          .where({ id: createdLead.id })
          .returning();
        
        return {
          lead: updatedLead,
          contacts: createdContacts,
          statuses: [],
        };
      }

      // Create statuses if any
      let createdStatuses: LeadStatus[] = [];
      if (data.statuses && data.statuses.length > 0) {
        const statusData = data.statuses.map(status => ({
          leadId: createdLead.id,
          status,
          tenantId,
        }));
        createdStatuses = await tx.insert(leadStatuses).values(statusData).returning();
      }

      return {
        lead: createdLead,
        contacts: createdContacts,
        statuses: createdStatuses,
      };
    });
  }

  /**
   * Create multiple leads with contacts in a single transaction
   */
  async createMultipleLeadsWithContacts(
    tenantId: string,
    data: BulkLeadCreationData
  ): Promise<BulkLeadCreationResult> {
    return await db.transaction(async (tx) => {
      const results: LeadCreationResult[] = [];
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < data.leadsWithContacts.length; i++) {
        try {
          const leadData = data.leadsWithContacts[i];
          
          // Create the lead
          const leadWithTenant = { ...leadData.lead, tenantId };
          const [createdLead] = await tx.insert(leads).values(leadWithTenant).returning();

          // Create contacts if any
          let createdContacts: LeadPointOfContact[] = [];
          if (leadData.contacts.length > 0) {
            const contactsWithLeadId = leadData.contacts.map(contact => ({
              ...contact,
              leadId: createdLead.id,
            }));
            createdContacts = await tx.insert(leadPointOfContacts).values(contactsWithLeadId).returning();
          }

          // Set primary contact if there's exactly one contact
          let finalLead = createdLead;
          if (createdContacts.length === 1) {
            const [updatedLead] = await tx
              .update(leads)
              .set({ primaryContactId: createdContacts[0].id })
              .where({ id: createdLead.id })
              .returning();
            finalLead = updatedLead;
          }

          // Create default statuses
          let createdStatuses: LeadStatus[] = [];
          const statusesToCreate = leadData.statuses || data.defaultStatuses;
          if (statusesToCreate.length > 0) {
            const statusData = statusesToCreate.map(status => ({
              leadId: createdLead.id,
              status,
              tenantId,
            }));
            createdStatuses = await tx.insert(leadStatuses).values(statusData).returning();
          }

          results.push({
            lead: finalLead,
            contacts: createdContacts,
            statuses: createdStatuses,
          });
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    });
  }

  /**
   * Update lead with new contacts (replace existing)
   */
  async updateLeadWithContacts(
    leadId: string,
    tenantId: string,
    data: {
      lead?: Partial<Omit<NewLead, 'tenantId'>>;
      contacts: Omit<NewLeadPointOfContact, 'leadId'>[];
    }
  ): Promise<LeadCreationResult> {
    return await db.transaction(async (tx) => {
      // Update lead if data provided
      let updatedLead: Lead;
      if (data.lead) {
        const [lead] = await tx
          .update(leads)
          .set(data.lead)
          .where({ id: leadId, tenantId })
          .returning();
        updatedLead = lead;
      } else {
        const [lead] = await tx
          .select()
          .from(leads)
          .where({ id: leadId, tenantId })
          .limit(1);
        updatedLead = lead;
      }

      // Delete existing contacts
      await tx.delete(leadPointOfContacts).where({ leadId });

      // Create new contacts
      let createdContacts: LeadPointOfContact[] = [];
      if (data.contacts.length > 0) {
        const contactsWithLeadId = data.contacts.map(contact => ({
          ...contact,
          leadId,
        }));
        createdContacts = await tx.insert(leadPointOfContacts).values(contactsWithLeadId).returning();
      }

      // Update primary contact
      const primaryContactId = createdContacts.length === 1 ? createdContacts[0].id : null;
      const [finalLead] = await tx
        .update(leads)
        .set({ primaryContactId })
        .where({ id: leadId })
        .returning();

      // Get existing statuses
      const existingStatuses = await tx
        .select()
        .from(leadStatuses)
        .where({ leadId, tenantId });

      return {
        lead: finalLead,
        contacts: createdContacts,
        statuses: existingStatuses,
      };
    });
  }

  /**
   * Delete lead and all associated data
   */
  async deleteLeadWithAllData(leadId: string, tenantId: string): Promise<{
    lead: Lead | undefined;
    contactsDeleted: number;
    statusesDeleted: number;
  }> {
    return await db.transaction(async (tx) => {
      // Delete contacts
      const deletedContacts = await tx
        .delete(leadPointOfContacts)
        .where({ leadId })
        .returning();

      // Delete statuses
      const deletedStatuses = await tx
        .delete(leadStatuses)
        .where({ leadId, tenantId })
        .returning();

      // Delete lead
      const [deletedLead] = await tx
        .delete(leads)
        .where({ id: leadId, tenantId })
        .returning();

      return {
        lead: deletedLead,
        contactsDeleted: deletedContacts.length,
        statusesDeleted: deletedStatuses.length,
      };
    });
  }

  /**
   * Bulk delete leads and all associated data
   */
  async deleteMultipleLeadsWithAllData(
    leadIds: string[],
    tenantId: string
  ): Promise<{
    leadsDeleted: Lead[];
    totalContactsDeleted: number;
    totalStatusesDeleted: number;
  }> {
    if (leadIds.length === 0) {
      return { leadsDeleted: [], totalContactsDeleted: 0, totalStatusesDeleted: 0 };
    }

    return await db.transaction(async (tx) => {
      // Delete contacts for all leads
      const deletedContacts = await tx
        .delete(leadPointOfContacts)
        .where(({ leadId }) => leadIds.includes(leadId))
        .returning();

      // Delete statuses for all leads
      const deletedStatuses = await tx
        .delete(leadStatuses)
        .where(({ leadId, tenantId: statusTenantId }) => 
          leadIds.includes(leadId) && statusTenantId === tenantId
        )
        .returning();

      // Delete leads
      const deletedLeads = await tx
        .delete(leads)
        .where(({ id, tenantId: leadTenantId }) => 
          leadIds.includes(id) && leadTenantId === tenantId
        )
        .returning();

      return {
        leadsDeleted: deletedLeads,
        totalContactsDeleted: deletedContacts.length,
        totalStatusesDeleted: deletedStatuses.length,
      };
    });
  }
}