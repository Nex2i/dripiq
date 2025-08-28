export interface LeadInitialProcessingJobPayload {
  tenantId: string;
  leadId: string;
  leadUrl: string;
  metadata?: Record<string, any>;
}

export interface LeadInitialProcessingJobResult {
  success: boolean;
  leadId: string;
  sitemapUrls?: string[];
  filteredUrls?: string[];
  batchScrapeJobId?: string;
  error?: string;
  errorCode?: 'INVALID_URL' | 'SITEMAP_FETCH_FAILED' | 'SMART_FILTER_FAILED' | 'BATCH_SCRAPE_FAILED' | 'UNKNOWN';
}