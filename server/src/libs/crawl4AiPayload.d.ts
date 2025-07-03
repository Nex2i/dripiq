export interface Crawl4AiPayload {
  urls: string[];
  browser_config?: BrowserConfig;
  crawler_config: CrawlerConfig;
  markdown_generator?: MarkdownGenerator;
  dispatcher?: Dispatcher;
}

interface BrowserConfig {
  type: 'BrowserConfig';
  params: {
    headless?: boolean;
    // Add other browser config parameters as needed
  };
}

interface Dispatcher {
  type: 'MemoryAdaptiveDispatcher';
  params: {
    memory_threshold_percent: number;
    check_interval: number;
    max_session_permit: number;
    memory_wait_timeout: number;
  };
}

interface CrawlerConfig {
  type: 'CrawlerRunConfig';
  params: CrawlerParams;
}

interface CrawlerParams {
  deep_crawl_strategy?: DeepCrawlStrategy;
  scraping_strategy?: ScrapingStrategy;
  exclude_social_media_domains?: string[];
  stream?: boolean;
  // Add other CrawlerRunConfig properties as needed based on openapi.yaml
  word_count_threshold?: number;
  extraction_strategy?: any; // Define a more specific interface if needed
  chunking_strategy?: any; // Define a more specific interface if needed
  only_text?: boolean;
  css_selector?: string;
  target_elements?: string[];
  excluded_tags?: string[];
  excluded_selector?: string;
  keep_data_attributes?: boolean;
  keep_attrs?: string[];
  remove_forms?: boolean;
  prettiify?: boolean;
  parser_type?: string;
  proxy_config?: any; // Define a more specific interface if needed
  proxy_rotation_strategy?: any; // Define a more specific interface if needed
  locale?: string;
  timezone_id?: string;
  geolocation?: any; // Define a more specific interface if needed
  fetch_ssl_certificate?: boolean;
  cache_mode?: string;
  session_id?: string;
  bypass_cache?: boolean;
  disable_cache?: boolean;
  no_cache_read?: boolean;
  no_cache_write?: boolean;
  shared_data?: Record<string, any>;
  wait_until?: string;
  page_timeout?: number;
  wait_for?: string;
  wait_for_images?: boolean;
  delay_before_return_html?: number;
  mean_delay?: number;
  max_range?: number;
  semaphore_count?: number;
  js_code?: string | string[];
  js_only?: boolean;
  ignore_body_visibility?: boolean;
  scan_full_page?: boolean;
  scroll_delay?: number;
  process_iframes?: boolean;
  remove_overlay_elements?: boolean;
  simulate_user?: boolean;
  override_navigator?: boolean;
  magic?: boolean;
  adjust_viewport_to_content?: boolean;
  screenshot?: boolean;
  screenshot_wait_for?: number;
  screenshot_height_threshold?: number;
  pdf?: boolean;
  capture_mhtml?: boolean;
  image_description_min_word_threshold?: number;
  image_score_threshold?: number;
  table_score_threshold?: number;
  exclude_external_images?: boolean;
  exclude_all_images?: boolean;
  exclude_external_links?: boolean;
  exclude_social_media_links?: boolean;
  exclude_domains?: string[];
  exclude_internal_links?: boolean;
  verbose?: boolean;
  log_console?: boolean;
  capture_network_requests?: boolean;
  capture_console_messages?: boolean;
  method?: string;
  url?: string;
  check_robots_txt?: boolean;
  user_agent?: string;
  user_agent_mode?: string;
  user_agent_generator_config?: Record<string, any>;
  experimental?: Record<string, any>;
}

interface DeepCrawlStrategy {
  type: 'BestFirstCrawlingStrategy' | 'BFSStrategy' | 'DFSStrategy'; // Updated to include BestFirstCrawlingStrategy
  params: {
    max_depth: number;
    include_external: boolean;
    max_pages: number;
  };
}

interface MarkdownGenerator {
  type: 'DefaultMarkdownGenerator'; // Or other generators if available
  params: Record<string, any>; // Parameters for the markdown generator
}

interface ScrapingStrategy {
  type: 'WebScrapingStrategy'; // Or other scraping strategies if available
  params: Record<string, any>; // Parameters for the scraping strategy
}
