import { and, eq, desc } from 'drizzle-orm';
import { campaignTransitions, CampaignTransition, NewCampaignTransition } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

/**
 * <summary>CampaignTransitionRepository records state changes for campaigns.</summary>
 * <summary>Provides a full audit trail of why/when transitions occurred and by whom.</summary>
 * <summary>Drives diagnostics, analytics, and rollback decisions during execution.</summary>
 */
export class CampaignTransitionRepository extends TenantAwareRepository<
  typeof campaignTransitions,
  CampaignTransition,
  NewCampaignTransition
> {
  constructor() {
    super(campaignTransitions);
  }

  async listByCampaignForTenant(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignTransition[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.campaignId, campaignId)))
      .orderBy(desc(this.table.occurredAt))) as CampaignTransition[];
  }
}
