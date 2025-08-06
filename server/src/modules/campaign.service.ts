import {
  type CampaignTemplateWithDetails,
  type CampaignTemplateSearchOptions,
  type ContactCampaignInstanceWithDetails,
  type StepEventWithDetails,
  leadPointOfContactRepository,
  campaignStepInstanceRepository,
  campaignStepTemplateRepository,
  campaignTemplateRepository,
  contactCampaignInstanceRepository,
  stepEventRepository,
} from '@/repositories';
import type {
  CampaignTemplate,
  CampaignStepTemplate,
  ContactCampaignInstance,
  CampaignStepInstance,
  NewCampaignStepInstance,
  StepEvent,
  NewStepEvent,
} from '@/db/schema';
import { NotFoundError, ValidationError } from '@/exceptions/error';

// Types for service operations
export interface CreateCampaignTemplateData {
  name: string;
  description?: string;
  createdBy?: string;
  steps?: CreateCampaignStepData[];
}

export interface CreateCampaignStepData {
  stepName: string;
  channel: string;
  config?: any;
  sendTimeWindowStart?: string;
  sendTimeWindowEnd?: string;
  delayAfterPrevious?: string;
  branching?: any;
  stepOrder?: number;
}

export interface LaunchCampaignData {
  campaignTemplateId: string;
  contactIds: string[];
  startDate?: Date;
}

export interface CampaignAnalytics {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalStepsSent: number;
  totalEvents: number;
  engagementRate: number;
  channelBreakdown: {
    channel: string;
    sent: number;
    events: number;
    engagementRate: number;
  }[];
}

/**
 * Campaign Template Operations
 */

/**
 * Create a new campaign template with steps
 */
export async function createCampaignTemplate(
  tenantId: string,
  data: CreateCampaignTemplateData
): Promise<CampaignTemplate> {
  try {
    const { steps, ...templateData } = data;

    // Create the campaign template
    const template = await campaignTemplateRepository.createForTenant(tenantId, {
      ...templateData,
    });

    // Create steps if provided
    if (steps && steps.length > 0) {
      const stepPromises = steps.map((step, index) =>
        campaignStepTemplateRepository.createForTenant(tenantId, {
          ...step,
          campaignTemplateId: template.id,
          stepOrder: step.stepOrder || index + 1,
        })
      );
      await Promise.all(stepPromises);
    }

    return template;
  } catch (error) {
    console.error('Error creating campaign template:', error);
    throw new Error('Failed to create campaign template');
  }
}

/**
 * Get campaign template with details (supports global templates)
 */
export async function getCampaignTemplate(
  templateId: string,
  tenantId: string
): Promise<CampaignTemplateWithDetails> {
  try {
    // Use fallback logic to find tenant-specific or global template
    const template = await campaignTemplateRepository.findTemplateWithFallback(
      templateId,
      tenantId
    );
    if (!template) {
      throw new NotFoundError(`Campaign template not found with id: ${templateId}`);
    }
    return template;
  } catch (error) {
    console.error('Error getting campaign template:', error);
    throw error;
  }
}

/**
 * Search campaign templates (includes global templates by default)
 */
export async function searchCampaignTemplates(
  tenantId: string,
  options: CampaignTemplateSearchOptions = {}
): Promise<{
  templates: CampaignTemplateWithDetails[];
  total: number;
}> {
  try {
    // Include global templates by default
    const searchOptions = { includeGlobal: true, ...options };

    const [templates, total] = await Promise.all([
      campaignTemplateRepository.searchForTenant(tenantId, searchOptions),
      campaignTemplateRepository.getCountForTenant(tenantId, searchOptions),
    ]);

    return { templates, total };
  } catch (error) {
    console.error('Error searching campaign templates:', error);
    throw new Error('Failed to search campaign templates');
  }
}

/**
 * Update campaign template
 */
export async function updateCampaignTemplate(
  templateId: string,
  tenantId: string,
  data: Partial<CreateCampaignTemplateData>
): Promise<CampaignTemplate> {
  try {
    const { steps, ...templateData } = data;

    const updatedTemplate = await campaignTemplateRepository.updateForTenant(
      templateId,
      tenantId,
      templateData
    );

    // Handle steps update if provided
    if (steps) {
      // For simplicity, this would need more complex logic to handle step updates
      // For now, we'll just indicate that step management should be done separately
      console.log('Step updates should be handled via separate step management functions');
    }

    return updatedTemplate;
  } catch (error) {
    console.error('Error updating campaign template:', error);
    throw error;
  }
}

/**
 * Delete campaign template
 */
export async function deleteCampaignTemplate(templateId: string, tenantId: string): Promise<void> {
  try {
    await campaignTemplateRepository.deleteForTenant(templateId, tenantId);
  } catch (error) {
    console.error('Error deleting campaign template:', error);
    throw error;
  }
}

/**
 * Get global templates only
 */
export async function getGlobalTemplates(): Promise<CampaignTemplateWithDetails[]> {
  try {
    return await campaignTemplateRepository.findGlobalTemplates();
  } catch (error) {
    console.error('Error getting global templates:', error);
    throw new Error('Failed to get global templates');
  }
}

/**
 * Create global campaign template (admin only)
 */
export async function createGlobalCampaignTemplate(
  data: CreateCampaignTemplateData
): Promise<CampaignTemplate> {
  try {
    const { steps, ...templateData } = data;

    // Create the global campaign template (no tenantId)
    const template = await campaignTemplateRepository.createGlobalTemplate(templateData);

    // Create steps if provided (these will be global template steps)
    if (steps && steps.length > 0) {
      const stepPromises = steps.map((step, index) =>
        campaignStepTemplateRepository.create({
          ...step,
          campaignTemplateId: template.id,
          stepOrder: step.stepOrder || index + 1,
          tenantId: null, // Global templates have no tenant
        })
      );
      await Promise.all(stepPromises);
    }

    return template;
  } catch (error) {
    console.error('Error creating global campaign template:', error);
    throw new Error('Failed to create global campaign template');
  }
}

/**
 * Get available templates for a tenant (includes global)
 */
export async function getAvailableTemplates(
  tenantId: string
): Promise<CampaignTemplateWithDetails[]> {
  try {
    return await campaignTemplateRepository.findTemplatesForTenantWithGlobal(tenantId);
  } catch (error) {
    console.error('Error getting available templates:', error);
    throw new Error('Failed to get available templates');
  }
}

/**
 * Campaign Step Template Operations
 */

/**
 * Get steps for a campaign template
 */
export async function getCampaignSteps(
  campaignTemplateId: string,
  tenantId: string
): Promise<CampaignStepTemplate[]> {
  try {
    return await campaignStepTemplateRepository.findByCampaignTemplateId(
      campaignTemplateId,
      tenantId
    );
  } catch (error) {
    console.error('Error getting campaign steps:', error);
    throw error;
  }
}

/**
 * Add step to campaign template
 */
export async function addCampaignStep(
  tenantId: string,
  data: CreateCampaignStepData & { campaignTemplateId: string }
): Promise<CampaignStepTemplate> {
  try {
    // Get next step order if not provided
    const stepOrder =
      data.stepOrder ||
      (await campaignStepTemplateRepository.getNextStepOrder(data.campaignTemplateId, tenantId));

    return await campaignStepTemplateRepository.createForTenant(tenantId, {
      ...data,
      stepOrder,
    });
  } catch (error) {
    console.error('Error adding campaign step:', error);
    throw error;
  }
}

/**
 * Campaign Instance Operations
 */

/**
 * Launch a campaign for multiple contacts
 */
export async function launchCampaign(
  tenantId: string,
  data: LaunchCampaignData
): Promise<{
  instances: ContactCampaignInstance[];
  stepInstances: CampaignStepInstance[];
}> {
  try {
    const { campaignTemplateId, contactIds, startDate = new Date() } = data;

    // Validate campaign template exists
    await campaignTemplateRepository.findByIdWithDetails(campaignTemplateId, tenantId);

    // Get campaign steps
    const steps = await campaignStepTemplateRepository.findByCampaignTemplateId(
      campaignTemplateId,
      tenantId
    );

    if (steps.length === 0) {
      throw new ValidationError('Campaign template has no steps defined');
    }

    // Validate contacts exist
    for (const contactId of contactIds) {
      const contact = await leadPointOfContactRepository.findByIdForTenant(contactId, tenantId);
      if (!contact) {
        throw new NotFoundError(`Contact not found: ${contactId}`);
      }
    }

    // Create campaign instances for each contact
    const instanceData = contactIds.map((contactId) => ({
      contactId,
      campaignTemplateId,
      status: 'active' as const,
      startedAt: startDate,
    }));

    const instances = await contactCampaignInstanceRepository.createBulkForTenant(
      tenantId,
      instanceData
    );

    // Create step instances for each campaign instance
    const stepInstanceData: Omit<NewCampaignStepInstance, 'tenantId'>[] = [];

    for (const instance of instances) {
      let currentScheduledTime = new Date(startDate);

      for (const step of steps) {
        // Calculate scheduled time based on delay
        if (step.stepOrder > 1 && step.delayAfterPrevious) {
          // Parse delay (simplified - in production you'd want more robust parsing)
          const delayMatch = step.delayAfterPrevious.match(/(\d+)\s*(day|hour|minute)s?/i);
          if (delayMatch) {
            const [, amount, unit] = delayMatch;
            if (amount && unit) {
              const delayMs =
                parseInt(amount) *
                (unit.toLowerCase().startsWith('day')
                  ? 24 * 60 * 60 * 1000
                  : unit.toLowerCase().startsWith('hour')
                    ? 60 * 60 * 1000
                    : 60 * 1000);
              currentScheduledTime = new Date(currentScheduledTime.getTime() + delayMs);
            }
          }
        }

        stepInstanceData.push({
          contactCampaignInstanceId: instance.id,
          campaignStepTemplateId: step.id,
          scheduledAt: new Date(currentScheduledTime),
          status: 'pending',
          channel: step.channel,
        });
      }
    }

    const stepInstances = await campaignStepInstanceRepository.createBulkForTenant(
      tenantId,
      stepInstanceData
    );

    return { instances, stepInstances };
  } catch (error) {
    console.error('Error launching campaign:', error);
    throw error;
  }
}

/**
 * Get campaign instances for a contact
 */
export async function getContactCampaigns(
  contactId: string,
  tenantId: string
): Promise<ContactCampaignInstance[]> {
  try {
    return await contactCampaignInstanceRepository.findByContactId(contactId, tenantId);
  } catch (error) {
    console.error('Error getting contact campaigns:', error);
    throw error;
  }
}

/**
 * Get campaign instance with details
 */
export async function getCampaignInstance(
  instanceId: string,
  tenantId: string
): Promise<ContactCampaignInstanceWithDetails> {
  try {
    return await contactCampaignInstanceRepository.findByIdWithDetails(instanceId, tenantId);
  } catch (error) {
    console.error('Error getting campaign instance:', error);
    throw error;
  }
}

/**
 * Pause a campaign instance
 */
export async function pauseCampaign(
  instanceId: string,
  tenantId: string
): Promise<ContactCampaignInstance> {
  try {
    return await contactCampaignInstanceRepository.pauseCampaign(instanceId, tenantId);
  } catch (error) {
    console.error('Error pausing campaign:', error);
    throw error;
  }
}

/**
 * Resume a campaign instance
 */
export async function resumeCampaign(
  instanceId: string,
  tenantId: string
): Promise<ContactCampaignInstance> {
  try {
    return await contactCampaignInstanceRepository.resumeCampaign(instanceId, tenantId);
  } catch (error) {
    console.error('Error resuming campaign:', error);
    throw error;
  }
}

/**
 * Step Instance Operations
 */

/**
 * Get pending step instances (for execution)
 */
export async function getPendingStepInstances(tenantId: string): Promise<CampaignStepInstance[]> {
  try {
    return await campaignStepInstanceRepository.findDueStepInstances(tenantId, new Date());
  } catch (error) {
    console.error('Error getting pending step instances:', error);
    throw error;
  }
}

/**
 * Mark step instance as sent
 */
export async function markStepAsSent(
  stepInstanceId: string,
  tenantId: string,
  renderedConfig?: any,
  branchOutcome?: string
): Promise<CampaignStepInstance> {
  try {
    return await campaignStepInstanceRepository.markAsSent(
      stepInstanceId,
      tenantId,
      renderedConfig,
      branchOutcome
    );
  } catch (error) {
    console.error('Error marking step as sent:', error);
    throw error;
  }
}

/**
 * Event Tracking Operations
 */

/**
 * Record a campaign event
 */
export async function recordEvent(
  tenantId: string,
  data: Omit<NewStepEvent, 'tenantId'>
): Promise<StepEvent> {
  try {
    return await stepEventRepository.createForTenant(tenantId, data);
  } catch (error) {
    console.error('Error recording campaign event:', error);
    throw error;
  }
}

/**
 * Get events for a step instance
 */
export async function getStepEvents(
  stepInstanceId: string,
  tenantId: string
): Promise<StepEvent[]> {
  try {
    return await stepEventRepository.findByStepInstanceId(stepInstanceId, tenantId);
  } catch (error) {
    console.error('Error getting step events:', error);
    throw error;
  }
}

/**
 * Get events for a contact
 */
export async function getContactEvents(
  contactId: string,
  tenantId: string
): Promise<StepEventWithDetails[]> {
  try {
    return await stepEventRepository.findByContactId(contactId, tenantId);
  } catch (error) {
    console.error('Error getting contact events:', error);
    throw error;
  }
}

/**
 * Analytics Operations
 */

/**
 * Get campaign analytics for a tenant
 */
export async function getCampaignAnalytics(
  tenantId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<CampaignAnalytics> {
  try {
    const { startDate, endDate } = options;

    // Get basic counts
    const [totalCampaigns, activeCampaigns, completedCampaigns, totalStepsSent, totalEvents] =
      await Promise.all([
        contactCampaignInstanceRepository.getCountForTenant(tenantId),
        contactCampaignInstanceRepository.getCountForTenant(tenantId, { status: 'active' }),
        contactCampaignInstanceRepository.getCountForTenant(tenantId, { status: 'completed' }),
        campaignStepInstanceRepository.getCountForTenant(tenantId, { status: 'sent' }),
        stepEventRepository.getCountForTenant(tenantId, {
          occurredAfter: startDate,
          occurredBefore: endDate,
        }),
      ]);

    // Calculate engagement rate
    const engagementRate = totalStepsSent > 0 ? (totalEvents / totalStepsSent) * 100 : 0;

    // Get channel breakdown (simplified)
    const channels = ['email', 'sms', 'video']; // Could be dynamic
    const channelBreakdown = await Promise.all(
      channels.map(async (channel) => {
        const sent = await campaignStepInstanceRepository.getCountForTenant(tenantId, {
          channel,
          status: 'sent',
        });
        const events = await stepEventRepository.getChannelEngagementRate(tenantId, channel, {
          occurredAfter: startDate,
          occurredBefore: endDate,
        });

        return {
          channel,
          sent,
          events: events.totalEngagements,
          engagementRate: events.engagementRate,
        };
      })
    );

    return {
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalStepsSent,
      totalEvents,
      engagementRate: Number(engagementRate.toFixed(2)),
      channelBreakdown,
    };
  } catch (error) {
    console.error('Error getting campaign analytics:', error);
    throw new Error('Failed to get campaign analytics');
  }
}

/**
 * Get recent campaign activity
 */
export async function getRecentActivity(
  tenantId: string,
  limit = 50
): Promise<StepEventWithDetails[]> {
  try {
    return await stepEventRepository.getRecentEvents(tenantId, limit);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    throw error;
  }
}
