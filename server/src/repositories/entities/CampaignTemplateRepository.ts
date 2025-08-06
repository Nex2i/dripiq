import { eq, and, desc, ilike } from 'drizzle-orm';
import { campaignTemplates, CampaignTemplate, NewCampaignTemplate, users } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface CampaignTemplateWithDetails extends Omit<CampaignTemplate, 'createdBy'> {
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface CampaignTemplateSearchOptions {
  searchQuery?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export class CampaignTemplateRepository extends TenantAwareRepository<
  typeof campaignTemplates,
  CampaignTemplate,
  NewCampaignTemplate
> {
  constructor() {
    super(campaignTemplates);
  }

  /**
   * Find campaign template by ID with creator details
   */
  async findByIdWithDetails(id: string, tenantId: string): Promise<CampaignTemplateWithDetails> {
    const result = await this.db
      .select({
        template: campaignTemplates,
        createdBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(campaignTemplates)
      .leftJoin(users, eq(campaignTemplates.createdBy, users.id))
      .where(and(eq(campaignTemplates.id, id), eq(campaignTemplates.tenantId, tenantId)))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`Campaign template not found with id: ${id}`);
    }

    return {
      ...result[0].template,
      createdBy: result[0].createdBy,
    };
  }

  /**
   * Search campaign templates for a tenant with pagination
   */
  async searchForTenant(
    tenantId: string,
    options: CampaignTemplateSearchOptions = {}
  ): Promise<CampaignTemplateWithDetails[]> {
    const { searchQuery, createdBy, limit = 50, offset = 0 } = options;

    // Build where conditions
    const whereConditions = [eq(campaignTemplates.tenantId, tenantId)];

    if (searchQuery) {
      whereConditions.push(ilike(campaignTemplates.name, `%${searchQuery}%`));
    }

    if (createdBy) {
      whereConditions.push(eq(campaignTemplates.createdBy, createdBy));
    }

    const results = await this.db
      .select({
        template: campaignTemplates,
        createdBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(campaignTemplates)
      .leftJoin(users, eq(campaignTemplates.createdBy, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(campaignTemplates.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((result) => ({
      ...result.template,
      createdBy: result.createdBy,
    }));
  }

  /**
   * Get campaign templates count for a tenant
   */
  async getCountForTenant(
    tenantId: string,
    options: Omit<CampaignTemplateSearchOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const { searchQuery, createdBy } = options;

    // Build where conditions
    const whereConditions = [eq(campaignTemplates.tenantId, tenantId)];

    if (searchQuery) {
      whereConditions.push(ilike(campaignTemplates.name, `%${searchQuery}%`));
    }

    if (createdBy) {
      whereConditions.push(eq(campaignTemplates.createdBy, createdBy));
    }

    const result = await this.db
      .select({ count: this.db.$count(campaignTemplates.id) })
      .from(campaignTemplates)
      .where(and(...whereConditions));

    return result[0]?.count || 0;
  }

  /**
   * Update campaign template for tenant
   */
  async updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewCampaignTemplate, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CampaignTemplate> {
    const updated = await this.db
      .update(campaignTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignTemplates.id, id), eq(campaignTemplates.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign template not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Delete campaign template for tenant
   */
  async deleteForTenant(id: string, tenantId: string): Promise<void> {
    const deleted = await this.db
      .delete(campaignTemplates)
      .where(and(eq(campaignTemplates.id, id), eq(campaignTemplates.tenantId, tenantId)))
      .returning();

    if (!deleted || !deleted[0]) {
      throw new NotFoundError(`Campaign template not found with id: ${id}`);
    }
  }

  /**
   * Check if campaign template exists for tenant
   */
  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: campaignTemplates.id })
      .from(campaignTemplates)
      .where(and(eq(campaignTemplates.id, id), eq(campaignTemplates.tenantId, tenantId)))
      .limit(1);

    return result.length > 0;
  }
}
