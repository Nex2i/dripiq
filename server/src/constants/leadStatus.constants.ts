export const LEAD_STATUS = {
  NEW: 'New',
  SCRAPING_SITE: 'Scraping Site',
  ANALYZING_SITE: 'Analyzing Site',
  EXTRACTING_CONTACTS: 'Extracting Contacts',
  PROCESSED: 'Processed',
} as const;

export type LeadStatusValue = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const LEAD_STATUS_VALUES = Object.values(LEAD_STATUS);

export const LEAD_STATUS_PRIORITY = {
  [LEAD_STATUS.PROCESSED]: 5,
  [LEAD_STATUS.EXTRACTING_CONTACTS]: 4,
  [LEAD_STATUS.ANALYZING_SITE]: 3,
  [LEAD_STATUS.SCRAPING_SITE]: 2,
  [LEAD_STATUS.NEW]: 1,
} as const;
