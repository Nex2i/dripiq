import { LEAD_STATUS } from './leadStatus.constants'

export const LEAD_STATUS_DEFINITIONS = {
  [LEAD_STATUS.UNPROCESSED]: 'Lead has been created and is waiting to be processed',
  [LEAD_STATUS.SYNCING_SITE]: 'Initial site sync and preparation is in progress',
  [LEAD_STATUS.SCRAPING_SITE]: 'Website content is being scraped and collected',
  [LEAD_STATUS.ANALYZING_SITE]: 'AI is analyzing the website content and extracting insights',
  [LEAD_STATUS.EXTRACTING_CONTACTS]: 'Contact information is being extracted from the website',
  [LEAD_STATUS.PROCESSED]: 'Lead has been fully processed and analyzed',
} as const

export const LEAD_STATUS_ORDERED = [
  LEAD_STATUS.UNPROCESSED,
  LEAD_STATUS.SYNCING_SITE,
  LEAD_STATUS.SCRAPING_SITE,
  LEAD_STATUS.ANALYZING_SITE,
  LEAD_STATUS.EXTRACTING_CONTACTS,
  LEAD_STATUS.PROCESSED,
] as const