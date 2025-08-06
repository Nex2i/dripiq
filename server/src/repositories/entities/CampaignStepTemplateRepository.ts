import { eq, and, asc, max } from 'drizzle-orm';
import {
  campaignStepTemplates,
  CampaignStepTemplate,
  NewCampaignStepTemplate,
  campaignTemplates,
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface CampaignStepTemplateWithCampaign extends CampaignStepTemplate {
  campaignTemplate?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface CampaignStepTemplateSearchOptions {
  campaignTemplateId?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}

export class CampaignStepTemplateRepository extends TenantAwareRepository<
  typeof campaignStepTemplates,
  CampaignStepTemplate,
  NewCampaignStepTemplate
> {
  constructor() {
    super(campaignStepTemplates);
  }

  /**
   * Find step template by ID with campaign details
   */
  async findByIdWithDetails(
    id: string,
    tenantId: string
  ): Promise<CampaignStepTemplateWithCampaign> {
    const result = await this.db
      .select({
        stepTemplate: campaignStepTemplates,
        campaignTemplate: {
          id: campaignTemplates.id,
          name: campaignTemplates.name,
          description: campaignTemplates.description,
        },
      })
      .from(campaignStepTemplates)
      .leftJoin(
        campaignTemplates,
        eq(campaignStepTemplates.campaignTemplateId, campaignTemplates.id)
      )
      .where(and(eq(campaignStepTemplates.id, id), eq(campaignStepTemplates.tenantId, tenantId)))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`Campaign step template not found with id: ${id}`);
    }

    return {
      ...result[0].stepTemplate,
      campaignTemplate: result[0].campaignTemplate,
    };
  }

  /**
   * Get all step templates for a campaign template, ordered by step order
   */
  async findByCampaignTemplateId(
    campaignTemplateId: string,
    tenantId: string
  ): Promise<CampaignStepTemplate[]> {
    return await this.db
      .select()
      .from(campaignStepTemplates)
      .where(
        and(
          eq(campaignStepTemplates.campaignTemplateId, campaignTemplateId),
          eq(campaignStepTemplates.tenantId, tenantId)
        )
      )
      .orderBy(asc(campaignStepTemplates.stepOrder));
  }

  /**
   * Search step templates for a tenant with pagination
   */
  async searchForTenant(
    tenantId: string,
    options: CampaignStepTemplateSearchOptions = {}
  ): Promise<CampaignStepTemplateWithCampaign[]> {
    const { campaignTemplateId, channel, limit = 50, offset = 0 } = options;

    let whereConditions = [eq(campaignStepTemplates.tenantId, tenantId)];

    if (campaignTemplateId) {
      whereConditions.push(eq(campaignStepTemplates.campaignTemplateId, campaignTemplateId));
    }

    if (channel) {
      whereConditions.push(eq(campaignStepTemplates.channel, channel));
    }

    const results = await this.db
      .select({
        stepTemplate: campaignStepTemplates,
        campaignTemplate: {
          id: campaignTemplates.id,
          name: campaignTemplates.name,
          description: campaignTemplates.description,
        },
      })
      .from(campaignStepTemplates)
      .leftJoin(
        campaignTemplates,
        eq(campaignStepTemplates.campaignTemplateId, campaignTemplates.id)
      )
      .where(and(...whereConditions))
      .orderBy(asc(campaignStepTemplates.stepOrder))
      .limit(limit)
      .offset(offset);

    return results.map((result) => ({
      ...result.stepTemplate,
      campaignTemplate: result.campaignTemplate,
    }));
  }

  /**
   * Get step templates count for a tenant
   */
  async getCountForTenant(
    tenantId: string,
    options: Omit<CampaignStepTemplateSearchOptions, 'limit' | 'offset'> = {}
  ): Promise<number> {
    const { campaignTemplateId, channel } = options;

    let whereConditions = [eq(campaignStepTemplates.tenantId, tenantId)];

    if (campaignTemplateId) {
      whereConditions.push(eq(campaignStepTemplates.campaignTemplateId, campaignTemplateId));
    }

    if (channel) {
      whereConditions.push(eq(campaignStepTemplates.channel, channel));
    }

    const result = await this.db
      .select({ count: this.db.$count(campaignStepTemplates.id) })
      .from(campaignStepTemplates)
      .where(and(...whereConditions));

    return result[0]?.count || 0;
  }

  /**
   * Update step template for tenant
   */
  async updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewCampaignStepTemplate, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CampaignStepTemplate> {
    const updated = await this.db
      .update(campaignStepTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignStepTemplates.id, id), eq(campaignStepTemplates.tenantId, tenantId)))
      .returning();

    if (!updated || !updated[0]) {
      throw new NotFoundError(`Campaign step template not found with id: ${id}`);
    }

    return updated[0];
  }

  /**
   * Delete step template for tenant
   */
  async deleteForTenant(id: string, tenantId: string): Promise<void> {
    const deleted = await this.db
      .delete(campaignStepTemplates)
      .where(and(eq(campaignStepTemplates.id, id), eq(campaignStepTemplates.tenantId, tenantId)))
      .returning();

    if (!deleted || !deleted[0]) {
      throw new NotFoundError(`Campaign step template not found with id: ${id}`);
    }
  }

  /**
   * Get the next step order for a campaign template
   */
  async getNextStepOrder(campaignTemplateId: string, tenantId: string): Promise<number> {
    const result = await this.db
      .select({ maxOrder: max(campaignStepTemplates.stepOrder) })
      .from(campaignStepTemplates)
      .where(
        and(
          eq(campaignStepTemplates.campaignTemplateId, campaignTemplateId),
          eq(campaignStepTemplates.tenantId, tenantId)
        )
      );

    const maxOrder = result[0]?.maxOrder || 0;
    return maxOrder + 1;
  }

  /**
   * Reorder step templates for a campaign template
   */
  async reorderSteps(
    campaignTemplateId: string,
    tenantId: string,
    stepOrders: { id: string; stepOrder: number }[]
  ): Promise<void> {
    // Update each step's order in a transaction
    await this.db.transaction(async (tx) => {
      for (const { id, stepOrder } of stepOrders) {
        await tx
          .update(campaignStepTemplates)
          .set({
            stepOrder,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(campaignStepTemplates.id, id),
              eq(campaignStepTemplates.campaignTemplateId, campaignTemplateId),
              eq(campaignStepTemplates.tenantId, tenantId)
            )
          );
      }
    });
  }

  /**
   * Get step templates by channel for a campaign template
   */
  async findByChannelForCampaign(
    campaignTemplateId: string,
    channel: string,
    tenantId: string
  ): Promise<CampaignStepTemplate[]> {
    return await this.db
      .select()
      .from(campaignStepTemplates)
      .where(
        and(
          eq(campaignStepTemplates.campaignTemplateId, campaignTemplateId),
          eq(campaignStepTemplates.channel, channel),
          eq(campaignStepTemplates.tenantId, tenantId)
        )
      )
      .orderBy(asc(campaignStepTemplates.stepOrder));
  }

  /**
   * Check if step template exists for tenant
   */
  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: campaignStepTemplates.id })
      .from(campaignStepTemplates)
      .where(and(eq(campaignStepTemplates.id, id), eq(campaignStepTemplates.tenantId, tenantId)))
      .limit(1);

    return result.length > 0;
  }
}
