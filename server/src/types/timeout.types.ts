export interface TimeoutJobParams {
  tenantId: string;
  campaignId: string;
  nodeId: string;
  messageId: string;
  eventType: 'no_open' | 'no_click';
  scheduledAt: Date;
}
