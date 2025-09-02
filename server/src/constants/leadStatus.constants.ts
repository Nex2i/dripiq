export const LEAD_STATUS = {
  UNPROCESSED: 'Unprocessed',
  INITIAL_PROCESSING: 'Initial Processing',
  SYNCING_SITE: 'Syncing Site',
  SCRAPING_SITE: 'Scraping Site',
  ANALYZING_SITE: 'Analyzing Site',
  EXTRACTING_CONTACTS: 'Extracting Contacts',
  PROCESSED: 'Processed',
  INITIAL_PROCESSING_FAILED: 'Initial Processing Failed',
} as const;

export type LeadStatusValue = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const LEAD_STATUS_VALUES = Object.values(LEAD_STATUS);

export const LEAD_STATUS_PRIORITY = {
  [LEAD_STATUS.PROCESSED]: 7,
  [LEAD_STATUS.EXTRACTING_CONTACTS]: 6,
  [LEAD_STATUS.ANALYZING_SITE]: 5,
  [LEAD_STATUS.SCRAPING_SITE]: 4,
  [LEAD_STATUS.SYNCING_SITE]: 3,
  [LEAD_STATUS.INITIAL_PROCESSING]: 2,
  [LEAD_STATUS.UNPROCESSED]: 1,
} as const;
