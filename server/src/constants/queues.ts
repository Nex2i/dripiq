export const QUEUE_NAMES = {
  lead_analysis: 'lead_analysis',
  campaign_creation: 'campaign_creation',
  campaign_execution: 'campaign_execution',
} as const;

export const JOB_NAMES = {
  lead_analysis: {
    process: 'lead_analysis.process',
  },
  campaign_creation: {
    create: 'campaign_creation.create',
  },
  campaign_execution: {
    initialize: 'campaign_execution.initialize',
  },
} as const;
