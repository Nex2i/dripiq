export const QUEUE_NAMES = {
  messages: 'messages',
  lead_analysis: 'lead_analysis',
  campaign_creation: 'campaign_creation',
} as const;

export const JOB_NAMES = {
  messages: {
    process: 'messages.process',
  },
  lead_analysis: {
    process: 'lead_analysis.process',
  },
  campaign_creation: {
    create: 'campaign_creation.create',
  },
} as const;
