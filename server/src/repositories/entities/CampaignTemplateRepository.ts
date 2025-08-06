import { eq, and, desc, ilike, isNull, or } from 'drizzle-orm';
import { campaignTemplates, CampaignTemplate, NewCampaignTemplate, users } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface CampaignTemplateWithDetails extends Omit<CampaignTemplate, 'createdBy'> {
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  isGlobal?: boolean;
}

export interface CampaignTemplateSearchOptions {
  searchQuery?: string;
  createdBy?: string;
  includeGlobal?: boolean;
  globalOnly?: boolean;
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
    const {
      searchQuery,
      createdBy,
      includeGlobal = true,
      globalOnly = false,
      limit = 50,
      offset = 0,
    } = options;

    // Build where conditions
    let whereConditions = [];

    if (globalOnly) {
      whereConditions.push(isNull(campaignTemplates.tenantId));
    } else if (includeGlobal) {
      whereConditions.push(
        or(eq(campaignTemplates.tenantId, tenantId), isNull(campaignTemplates.tenantId))
      );
    } else {
      whereConditions.push(eq(campaignTemplates.tenantId, tenantId));
    }

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
      isGlobal: result.template.tenantId === null,
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

  /**
   * Get global templates only
   */
  async findGlobalTemplates(): Promise<CampaignTemplateWithDetails[]> {
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
      .where(isNull(campaignTemplates.tenantId))
      .orderBy(desc(campaignTemplates.createdAt));

    return results.map((result) => ({
      ...result.template,
      createdBy: result.createdBy,
      isGlobal: true,
    }));
  }

  /**
   * Get templates for tenant including global templates
   */
  async findTemplatesForTenantWithGlobal(tenantId: string): Promise<CampaignTemplateWithDetails[]> {
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
      .where(or(eq(campaignTemplates.tenantId, tenantId), isNull(campaignTemplates.tenantId)))
      .orderBy(desc(campaignTemplates.createdAt));

    return results.map((result) => ({
      ...result.template,
      createdBy: result.createdBy,
      isGlobal: result.template.tenantId === null,
    }));
  }

  /**
   * Find template with fallback logic (prefer tenant-specific, fallback to global)
   */
  async findTemplateWithFallback(
    templateId: string,
    tenantId: string
  ): Promise<CampaignTemplateWithDetails | null> {
    // First try tenant-specific template
    try {
      const tenantTemplate = await this.findByIdWithDetails(templateId, tenantId);
      return { ...tenantTemplate, isGlobal: false };
    } catch (_error) {
      // If not found, try global template
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
        .where(and(eq(campaignTemplates.id, templateId), isNull(campaignTemplates.tenantId)))
        .limit(1);

      if (!result || !result[0]) {
        return null;
      }

      return {
        ...result[0].template,
        createdBy: result[0].createdBy,
        isGlobal: true,
      };
    }
  }

  /**
   * Create global template (no tenant_id)
   */
  async createGlobalTemplate(
    data: Omit<NewCampaignTemplate, 'tenantId'>
  ): Promise<CampaignTemplate> {
    return await this.create({ ...data, tenantId: null });
  }

  /**
   * Check if template is global
   */
  async isGlobalTemplate(templateId: string): Promise<boolean> {
    const result = await this.db
      .select({ tenantId: campaignTemplates.tenantId })
      .from(campaignTemplates)
      .where(eq(campaignTemplates.id, templateId))
      .limit(1);

    return result.length > 0 && result[0]?.tenantId === null;
  }
}
