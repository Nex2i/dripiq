import { eq, and, inArray } from 'drizzle-orm';
import { 
  leads, 
  leadPointOfContacts, 
  leadStatuses, 
  siteEmbeddingDomains, 
  siteEmbeddings,
  NewLead, 
  NewLeadPointOfContact, 
  NewLeadStatus,
  Lead,
  LeadPointOfContact,
  LeadStatus,
  SiteEmbeddingDomain,
  NewSiteEmbeddingDomain,
  NewSiteEmbedding
} from '@/db/schema';
import { BaseRepository } from './base.repository';

export class TransactionRepository extends BaseRepository {
  /**
   * Create a lead with point of contacts and initial status in a transaction
   */
  async createLeadWithContacts(
    leadData: NewLead,
    pointOfContacts: Omit<NewLeadPointOfContact, 'leadId'>[],
    tenantId: string,
    userId?: string
  ): Promise<{
    lead: Lead;
    contacts: LeadPointOfContact[];
  }> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.transaction(async (tx) => {
        // Create the lead
        const [createdLead] = await tx.insert(leads).values(leadData).returning();
        if (!createdLead) {
          throw new Error('Failed to create lead');
        }

        let createdContacts: LeadPointOfContact[] = [];

        // Create point of contacts if provided
        if (pointOfContacts && pointOfContacts.length > 0) {
          const contactsWithLeadId = pointOfContacts.map((contact) => ({
            ...contact,
            leadId: createdLead.id,
          }));

          createdContacts = await tx.insert(leadPointOfContacts).values(contactsWithLeadId).returning();

          // Update lead with primary contact if contacts were created
          if (createdContacts.length > 0) {
            const [updatedLead] = await tx
              .update(leads)
              .set({ primaryContactId: createdContacts[0]!.id })
              .where(eq(leads.id, createdLead.id))
              .returning();

            if (updatedLead) {
              Object.assign(createdLead, updatedLead);
            }
          }
        }

        // Create initial status
        await tx.insert(leadStatuses).values({
          leadId: createdLead.id,
          status: 'new',
          tenantId,
        });

        return { lead: createdLead, contacts: createdContacts };
      });

      return result;
    } catch (error) {
      this.handleError(error, 'createLeadWithContacts');
    }
  }

  /**
   * Update lead statuses by adding and removing specific statuses in a transaction
   */
  async updateLeadStatuses(
    leadId: string,
    statusesToAdd: string[],
    statusesToRemove: string[],
    tenantId: string,
    userId?: string
  ): Promise<LeadStatus[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.transaction(async (tx) => {
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

        // Add new statuses (avoid duplicates)
        const currentStatusNames = new Set(currentStatuses.map((s) => s.status));
        const statusesToInsert: NewLeadStatus[] = [];

        for (const status of statusesToAdd) {
          if (!currentStatusNames.has(status) && !statusesToRemove.includes(status)) {
            statusesToInsert.push({
              leadId,
              status,
              tenantId,
            });
          }
        }

        if (statusesToInsert.length > 0) {
          await tx.insert(leadStatuses).values(statusesToInsert);
        }

        // Return updated statuses
        const updatedStatuses = await tx
          .select()
          .from(leadStatuses)
          .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
          .orderBy(leadStatuses.createdAt);

        // Ensure 'new' status is added if no statuses remain
        if (updatedStatuses.length === 0) {
          await tx.insert(leadStatuses).values({
            leadId,
            status: 'new',
            tenantId,
          });

          // Return the 'new' status
          return await tx
            .select()
            .from(leadStatuses)
            .where(and(eq(leadStatuses.leadId, leadId), eq(leadStatuses.tenantId, tenantId)))
            .orderBy(leadStatuses.createdAt);
        }

        return updatedStatuses;
      });

      return result;
    } catch (error) {
      this.handleError(error, 'updateLeadStatuses');
    }
  }

  /**
   * Get or create site embedding domain in a transaction
   */
  async getOrCreateSiteEmbeddingDomain(
    domain: string,
    tenantId: string,
    userId?: string
  ): Promise<SiteEmbeddingDomain> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(siteEmbeddingDomains)
          .where(eq(siteEmbeddingDomains.domain, domain))
          .limit(1);

        if (existing.length > 0) {
          return existing[0]!;
        }

        const [inserted] = await tx
          .insert(siteEmbeddingDomains)
          .values({
            domain,
            scrapedAt: new Date(),
          })
          .returning();

        if (!inserted) {
          throw new Error('Failed to create site embedding domain');
        }

        return inserted;
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getOrCreateSiteEmbeddingDomain');
    }
  }

  /**
   * Bulk create site embeddings in a transaction
   */
  async bulkCreateSiteEmbeddings(
    embeddings: NewSiteEmbedding[],
    tenantId: string,
    userId?: string
  ): Promise<void> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      await this.db.transaction(async (tx) => {
        // Process in batches to avoid overwhelming the database
        const batchSize = 100;
        for (let i = 0; i < embeddings.length; i += batchSize) {
          const batch = embeddings.slice(i, i + batchSize);
          await tx.insert(siteEmbeddings).values(batch);
        }
      });
    } catch (error) {
      this.handleError(error, 'bulkCreateSiteEmbeddings');
    }
  }

  /**
   * Generic transaction wrapper for custom operations
   */
  async executeInTransaction<T>(
    operation: (tx: any) => Promise<T>,
    tenantId: string,
    userId?: string
  ): Promise<T> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db.transaction(operation);
    } catch (error) {
      this.handleError(error, 'executeInTransaction');
    }
  }

  /**
   * Bulk delete leads and their related data in a transaction
   */
  async bulkDeleteLeads(
    leadIds: string[],
    tenantId: string,
    userId?: string
  ): Promise<number> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db.transaction(async (tx) => {
        // Delete related data first (due to foreign key constraints)
        await tx
          .delete(leadPointOfContacts)
          .where(inArray(leadPointOfContacts.leadId, leadIds));

        await tx
          .delete(leadStatuses)
          .where(and(
            inArray(leadStatuses.leadId, leadIds),
            eq(leadStatuses.tenantId, tenantId)
          ));

        // Delete the leads
        const deletedLeads = await tx
          .delete(leads)
          .where(and(
            inArray(leads.id, leadIds),
            eq(leads.tenantId, tenantId)
          ))
          .returning();

        return deletedLeads.length;
      });

      return result;
    } catch (error) {
      this.handleError(error, 'bulkDeleteLeads');
    }
  }
}