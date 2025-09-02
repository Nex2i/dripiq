import type { CampaignPlanOutput } from '../modules/ai/schemas/contactCampaignStrategySchema';

export interface ProcessTimeoutTransitionParams {
  tenantId: string;
  campaignId: string;
  contactId: string;
  leadId: string;
  timeoutEventType: string;
  currentNodeId: string;
  plan: CampaignPlanOutput;
  originalJobId?: string;
  scheduledAt?: Date;
}

export interface TimeoutTransitionResult {
  success: boolean;
  fromNodeId?: string;
  toNodeId?: string;
  timeoutEventType?: string;
  transitionId?: string;
  nextAction?: NextActionResult;
  reason?: string;
  availableTransitions?: number;
  skipped?: boolean;
}

export interface NextActionResult {
  scheduled: boolean;
  actionType?: 'send' | 'wait' | 'stop';
  scheduledAt?: Date;
  scheduledActionId?: string;
  nodeId?: string;
  reason?: string;
}