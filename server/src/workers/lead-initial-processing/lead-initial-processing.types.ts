export interface LeadInitialProcessingJobPayload {
  tenantId: string;
  leadId: string;
  leadUrl: string;
  metadata?: Record<string, string>;
  firecrawlJobId?: string; // Track firecrawl job ID to prevent duplicates
}

export interface LeadInitialProcessingJobResult {
  success: boolean;
  leadId: string;
  sitemapUrls?: string[];
  filteredUrls?: string[];
  batchScrapeJobId?: string;
  firecrawlJobId?: string; // Return the firecrawl job ID for tracking
  skippedScraping?: boolean;
  error?: string;
  errorCode?:
    | 'INVALID_URL'
    | 'SITEMAP_FETCH_FAILED'
    | 'SMART_FILTER_FAILED'
    | 'BATCH_SCRAPE_FAILED'
    | 'UNKNOWN';
}
