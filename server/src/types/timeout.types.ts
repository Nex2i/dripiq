export interface TimeoutJobPayload {
  tenantId: string;
  campaignId: string;
  nodeId: string;
  messageId: string;
  eventType: 'no_open' | 'no_click';
}

export interface TimeoutJobParams {
  campaignId: string;
  nodeId: string;
  messageId: string;
  eventType: 'no_open' | 'no_click';
  scheduledAt: Date;
}
