import type { CampaignPlanOutput } from '../modules/ai/schemas/contactCampaignStrategySchema';

export interface ProcessTransitionParams {
  tenantId: string;
  campaignId: string;
  contactId: string;
  leadId: string;
  eventType: string;
  currentNodeId: string;
  plan: CampaignPlanOutput;
}

export interface TransitionResult {
  success: boolean;
  fromNodeId?: string;
  toNodeId?: string;
  eventType?: string;
  transitionId?: string;
  nextAction?: NextActionResult;
  reason?: string;
  availableTransitions?: number;
}

export interface NextActionResult {
  scheduled: boolean;
  actionType?: 'send' | 'wait' | 'stop';
  scheduledAt?: Date;
  scheduledActionId?: string;
  nodeId?: string;
  reason?: string;
}

export interface TimingConstraints {
  nodeStartTime: Date;
  eventTime: Date;
  constraint: { within?: string; after?: string };
}
