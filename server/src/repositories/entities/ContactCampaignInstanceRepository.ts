import { eq, and, desc } from 'drizzle-orm';
import {
  contactCampaignInstances,
  ContactCampaignInstance,
  NewContactCampaignInstance,
  campaignTemplates,
  leadPointOfContacts,
  leads,
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface ContactCampaignInstanceWithDetails extends ContactCampaignInstance {
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    lead?: {
      id: string;
      name: string;
    } | null;
  } | null;
  campaignTemplate?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface ContactCampaignInstanceSearchOptions {
  contactId?: string;
  campaignTemplateId?: string;
  status?: string;
  leadId?: string;
  limit?: number;
  offset?: number;
}

export class ContactCampaignInstanceRepository extends TenantAwareRepository<
  typeof contactCampaignInstances,
  ContactCampaignInstance,
  NewContactCampaignInstance
> {
  constructor() {
    super(contactCampaignInstances);
  }

  /**
   * Find campaign instance by ID with full details
   */
  async findByIdWithDetails(
    id: string,
    tenantId: string
  ): Promise<ContactCampaignInstanceWithDetails> {
    const result = await this.db
      .select({
        instance: contactCampaignInstances,
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
          phone: leadPointOfContacts.phone,
          title: leadPointOfContacts.title,
        },
        lead: {
          id: leads.id,
          name: leads.name,
        },
        campaignTemplate: {
          id: campaignTemplates.id,
          name: campaignTemplates.name,
          description: campaignTemplates.description,
        },
      })
      .from(contactCampaignInstances)
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .leftJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .leftJoin(
        campaignTemplates,
        eq(contactCampaignInstances.campaignTemplateId, campaignTemplates.id)
      )
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`Contact campaign instance not found with id: ${id}`);
    }

    return {
      ...result[0].instance,
      contact: result[0].contact
        ? {
            ...result[0].contact,
            lead: result[0].lead,
          }
        : null,
      campaignTemplate: result[0].campaignTemplate,
    };
  }

  /**
   * Search campaign instances for a tenant with pagination and filters
   */
  async searchForTenant(
    tenantId: string,
    options: ContactCampaignInstanceSearchOptions = {}
  ): Promise<ContactCampaignInstanceWithDetails[]> {
    const { contactId, campaignTemplateId, status, leadId, limit = 50, offset = 0 } = options;

    let whereConditions = [eq(contactCampaignInstances.tenantId, tenantId)];

    if (contactId) {
      whereConditions.push(eq(contactCampaignInstances.contactId, contactId));
    }

    if (campaignTemplateId) {
      whereConditions.push(eq(contactCampaignInstances.campaignTemplateId, campaignTemplateId));
    }

    if (status) {
      whereConditions.push(eq(contactCampaignInstances.status, status));
    }

    if (leadId) {
      whereConditions.push(eq(leads.id, leadId));
    }

    const results = await this.db
      .select({
        instance: contactCampaignInstances,
        contact: {
          id: leadPointOfContacts.id,
          name: leadPointOfContacts.name,
          email: leadPointOfContacts.email,
          phone: leadPointOfContacts.phone,
          title: leadPointOfContacts.title,
        },
        lead: {
          id: leads.id,
          name: leads.name,
        },
        campaignTemplate: {
          id: campaignTemplates.id,
          name: campaignTemplates.name,
          description: campaignTemplates.description,
        },
      })
      .from(contactCampaignInstances)
      .leftJoin(leadPointOfContacts, eq(contactCampaignInstances.contactId, leadPointOfContacts.id))
      .leftJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .leftJoin(
        campaignTemplates,
        eq(contactCampaignInstances.campaignTemplateId, campaignTemplates.id)
      )
      .where(and(...whereConditions))
      .orderBy(desc(contactCampaignInstances.startedAt))
      .limit(limit)
      .offset(offset);

    return results.map((result) => ({
      ...result.instance,
      contact: result.contact
        ? {
            ...result.contact,
            lead: result.lead,
          }
        : null,
      campaignTemplate: result.campaignTemplate,
    }));
  }

  /**
   * Get campaign instances count for a tenant
   */
  async getCountForTenant(
    tenantId: string,
    options: Omit<ContactCampaignInstanceSearchOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const { contactId, campaignTemplateId, status, leadId } = options;

    let whereConditions = [eq(contactCampaignInstances.tenantId, tenantId)];

    if (contactId) {
      whereConditions.push(eq(contactCampaignInstances.contactId, contactId));
    }

    if (campaignTemplateId) {
      whereConditions.push(eq(contactCampaignInstances.campaignTemplateId, campaignTemplateId));
    }

    if (status) {
      whereConditions.push(eq(contactCampaignInstances.status, status));
    }

    if (leadId) {
      // Join with contacts to filter by leadId
      const result = await this.db
        .select({ count: this.db.$count(contactCampaignInstances.id) })
        .from(contactCampaignInstances)
        .leftJoin(
          leadPointOfContacts,
          eq(contactCampaignInstances.contactId, leadPointOfContacts.id)
        )
        .where(and(...whereConditions, eq(leadPointOfContacts.leadId, leadId)));

      return result[0]?.count || 0;
    }

    const result = await this.db
      .select({ count: this.db.$count(contactCampaignInstances.id) })
      .from(contactCampaignInstances)
      .where(and(...whereConditions));

    return result[0]?.count || 0;
  }

  /**
   * Update campaign instance for tenant
   */
  async updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewContactCampaignInstance, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<ContactCampaignInstance> {
    const updated = await this.db
      .update(contactCampaignInstances)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Contact campaign instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Delete campaign instance for tenant
   */
  async deleteForTenant(id: string, tenantId: string): Promise<void> {
    const deleted = await this.db
      .delete(contactCampaignInstances)
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .returning();

    if (!deleted || !deleted[0]) {
      throw new NotFoundError(`Contact campaign instance not found with id: ${id}`);
    }
  }

  /**
   * Get all campaign instances for a contact
   */
  async findByContactId(contactId: string, tenantId: string): Promise<ContactCampaignInstance[]> {
    return await this.db
      .select()
      .from(contactCampaignInstances)
      .where(
        and(
          eq(contactCampaignInstances.contactId, contactId),
          eq(contactCampaignInstances.tenantId, tenantId)
        )
      )
      .orderBy(desc(contactCampaignInstances.startedAt));
  }

  /**
   * Get all campaign instances for a campaign template
   */
  async findByCampaignTemplateId(
    campaignTemplateId: string,
    tenantId: string
  ): Promise<ContactCampaignInstance[]> {
    return await this.db
      .select()
      .from(contactCampaignInstances)
      .where(
        and(
          eq(contactCampaignInstances.campaignTemplateId, campaignTemplateId),
          eq(contactCampaignInstances.tenantId, tenantId)
        )
      )
      .orderBy(desc(contactCampaignInstances.startedAt));
  }

  /**
   * Get active campaign instances (for scheduling)
   */
  async findActiveInstances(tenantId: string): Promise<ContactCampaignInstance[]> {
    return await this.db
      .select()
      .from(contactCampaignInstances)
      .where(
        and(
          eq(contactCampaignInstances.status, 'active'),
          eq(contactCampaignInstances.tenantId, tenantId)
        )
      )
      .orderBy(desc(contactCampaignInstances.startedAt));
  }

  /**
   * Complete a campaign instance
   */
  async completeCampaign(id: string, tenantId: string): Promise<ContactCampaignInstance> {
    const updated = await this.db
      .update(contactCampaignInstances)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Contact campaign instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Pause a campaign instance
   */
  async pauseCampaign(id: string, tenantId: string): Promise<ContactCampaignInstance> {
    const updated = await this.db
      .update(contactCampaignInstances)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Contact campaign instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Resume a campaign instance
   */
  async resumeCampaign(id: string, tenantId: string): Promise<ContactCampaignInstance> {
    const updated = await this.db
      .update(contactCampaignInstances)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Contact campaign instance not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Check if campaign instance exists for tenant
   */
  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: contactCampaignInstances.id })
      .from(contactCampaignInstances)
      .where(
        and(eq(contactCampaignInstances.id, id), eq(contactCampaignInstances.tenantId, tenantId))
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Bulk create campaign instances for multiple contacts
   */
  async createBulkForTenant(
    tenantId: string,
    data: Omit<NewContactCampaignInstance, 'tenantId'>[]
  ): Promise<ContactCampaignInstance[]> {
    const dataWithTenant = data.map((item) => ({ ...item, tenantId }));
    return await this.createMany(dataWithTenant);
  }
}
