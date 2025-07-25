export const LEAD_STATUS = {
  UNPROCESSED: 'Unprocessed',
  SYNCING_SITE: 'Syncing Site',
  SCRAPING_SITE: 'Scraping Site',
  ANALYZING_SITE: 'Analyzing Site',
  EXTRACTING_CONTACTS: 'Extracting Contacts',
  PROCESSED: 'Processed',
} as const;

export type LeadStatusValue = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const LEAD_STATUS_VALUES = Object.values(LEAD_STATUS);

export const LEAD_STATUS_PRIORITY = {
  [LEAD_STATUS.PROCESSED]: 6,
  [LEAD_STATUS.EXTRACTING_CONTACTS]: 5,
  [LEAD_STATUS.ANALYZING_SITE]: 4,
  [LEAD_STATUS.SCRAPING_SITE]: 3,
  [LEAD_STATUS.SYNCING_SITE]: 2,
  [LEAD_STATUS.UNPROCESSED]: 1,
} as const;
