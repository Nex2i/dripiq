import { createHash } from 'crypto';
import { contactCampaignRepository, campaignPlanVersionRepository } from '@/repositories';
import type { CampaignPlanOutput } from './schemas/contactCampaignStrategySchema';

export type PersistPlanArgs = {
  tenantId: string;
  leadId: string;
  contactId: string;
  userId?: string;
  plan: CampaignPlanOutput;
  channel?: 'email';
};

export type PersistPlanResult = {
  campaignId: string;
  planHash: string;
  version: string;
  isNewCampaign: boolean;
  isNewVersion: boolean;
};

/**
 * Service responsible for persisting Contact Campaign Plans.
 * - Creates/updates `contact_campaigns`
 * - Appends `campaign_plan_versions` immutably
 */
export class ContactCampaignPlanService {
  async persistPlan(args: PersistPlanArgs): Promise<PersistPlanResult> {
    const { tenantId, leadId, contactId, userId, plan, channel = 'email' } = args;

    const baseVersion = plan.version || '1.0';
    const planHash = this.computePlanHash(plan);

    // Upsert campaign by (tenant, contact, channel)
    const existingCampaign = await contactCampaignRepository.findByContactAndChannelForTenant(
      tenantId,
      contactId,
      channel
    );

    let isNewCampaign = false;
    let campaign = existingCampaign;

    if (!campaign) {
      isNewCampaign = true;
      campaign = await contactCampaignRepository.createForTenant(tenantId, {
        leadId,
        contactId,
        channel,
        status: 'draft',
        currentNodeId: plan.startNodeId,
        planJson: plan,
        planVersion: baseVersion,
        planHash,
        senderIdentityId: plan.senderIdentityId ?? null,
      });
    } else if (campaign.planHash !== planHash) {
      // Update to the new plan
      campaign = await contactCampaignRepository.updateByIdForTenant(campaign.id, tenantId, {
        currentNodeId: plan.startNodeId,
        planJson: plan,
        planVersion: baseVersion,
        planHash,
        senderIdentityId: plan.senderIdentityId ?? null,
      });
    }

    if (!campaign) {
      throw new Error('Failed to create or update contact campaign');
    }

    // Ensure a plan version exists and create a new one if the hash has changed
    const { isNewVersion, version } = await this.ensurePlanVersion({
      tenantId,
      campaignId: campaign.id,
      userId,
      plan,
      baseVersion,
      planHash,
    });

    // If we created a new version with a different version string, keep campaign.planVersion in sync
    if (campaign.planVersion !== version) {
      campaign = await contactCampaignRepository.updateByIdForTenant(campaign.id, tenantId, {
        planVersion: version,
      });
    }

    // At this point, campaign is guaranteed not null; ensure non-null assertion for TS
    const campaignIdFinal = campaign!.id;

    return {
      campaignId: campaignIdFinal,
      planHash,
      version,
      isNewCampaign,
      isNewVersion,
    };
  }

  private async ensurePlanVersion(args: {
    tenantId: string;
    campaignId: string;
    userId?: string;
    plan: CampaignPlanOutput;
    baseVersion: string;
    planHash: string;
  }): Promise<{ isNewVersion: boolean; version: string }> {
    const { tenantId, campaignId, userId, plan, baseVersion, planHash } = args;

    // 1) Try exact baseVersion row
    const existingBase = await campaignPlanVersionRepository.findByCampaignAndVersionForTenant(
      tenantId,
      campaignId,
      baseVersion
    );

    if (!existingBase) {
      await campaignPlanVersionRepository.createForTenant(tenantId, {
        campaignId,
        version: baseVersion,
        planJson: plan,
        planHash,
        createdBy: userId ?? null,
      });
      return { isNewVersion: true, version: baseVersion };
    }

    // If the hash is the same, no new version is needed
    if (existingBase.planHash === planHash) {
      return { isNewVersion: false, version: existingBase.version };
    }

    // 2) Need a new unique version. Derive next suffix: `${baseVersion}-${N}`
    const allVersions = await campaignPlanVersionRepository.listByCampaignForTenant(
      tenantId,
      campaignId
    );

    const suffixNumbers: number[] = [];
    for (const v of allVersions) {
      if (v.version === baseVersion) {
        suffixNumbers.push(1); // treat base as 1 for ordering purposes
      } else if (v.version.startsWith(`${baseVersion}-`)) {
        const suffix = v.version.substring(baseVersion.length + 1);
        const n = Number.parseInt(suffix, 10);
        if (!Number.isNaN(n)) suffixNumbers.push(n);
      }
    }

    const next = suffixNumbers.length === 0 ? 2 : Math.max(...suffixNumbers) + 1;
    const nextVersion = `${baseVersion}-${next}`;

    await campaignPlanVersionRepository.createForTenant(tenantId, {
      campaignId,
      version: nextVersion,
      planJson: plan,
      planHash,
      createdBy: userId ?? null,
    });

    return { isNewVersion: true, version: nextVersion };
  }

  private computePlanHash(plan: CampaignPlanOutput): string {
    const stable = this.stableStringify(plan);
    return createHash('sha256').update(stable).digest('hex');
  }

  private stableStringify(value: unknown): string {
    // Stable stringify: sorts object keys recursively
    return JSON.stringify(value, (_key, val) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(val as Record<string, unknown>).sort()) {
          (sorted as any)[k] = (val as any)[k];
        }
        return sorted;
      }
      return val;
    });
  }
}

export const contactCampaignPlanService = new ContactCampaignPlanService();
