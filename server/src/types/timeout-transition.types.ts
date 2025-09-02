import type { CampaignPlanOutput } from '../modules/ai/schemas/contactCampaignStrategySchema';
import type { NextActionResult } from './campaign-transition.types';

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
