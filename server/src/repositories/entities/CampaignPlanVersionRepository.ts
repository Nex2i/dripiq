import { and, eq, desc } from 'drizzle-orm';
import {
  campaignPlanVersions,
  CampaignPlanVersion,
  NewCampaignPlanVersion,
} from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class CampaignPlanVersionRepository extends TenantAwareRepository<
  typeof campaignPlanVersions,
  CampaignPlanVersion,
  NewCampaignPlanVersion
> {
  constructor() {
    super(campaignPlanVersions);
  }

  async findByCampaignAndVersionForTenant(
    tenantId: string,
    campaignId: string,
    version: string
  ): Promise<CampaignPlanVersion | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.campaignId, campaignId),
          eq(this.table.version, version)
        )
      )
      .limit(1);
    return results[0];
  }

  async listByCampaignForTenant(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignPlanVersion[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)))
      .orderBy(desc(this.table.createdAt));
  }
}