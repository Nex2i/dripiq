import dotenv from 'dotenv';
import { Crawl4AiPayload } from './crawl4AiPayload';

// Load environment variables from .env file
dotenv.config();

class Crawl4AiClient {
  private baseURL = process.env.CRAWL_4_AI_URL;
  constructor() {}

  async crawl(payload: Crawl4AiPayload) {
    payload.crawler_config.params.verbose = true;
    payload.crawler_config.params.exclude_social_media_domains = [
      'facebook.com',
      'twitter.com',
      'x.com',
      'linkedin.com',
      'instagram.com',
      'pinterest.com',
      'tiktok.com',
      'snapchat.com',
      'reddit.com',
    ];
    payload.crawler_config.params.stream = false;
    payload.crawler_config.params.wait_for = 'css:main';
    payload.crawler_config.params.delay_before_return_html = 3.0;
    payload.crawler_config.params.scan_full_page = true;
    payload.crawler_config.params.scroll_delay = 0.5;
    payload.dispatcher = {
      type: 'MemoryAdaptiveDispatcher',
      params: {
        memory_threshold_percent: 70.0,
        check_interval: 1.0,
        max_session_permit: 25,
        memory_wait_timeout: 300.0,
      },
    };
    payload.browser_config = {
      type: 'BrowserConfig',
      params: {
        headless: true,
      },
    };

    const response = await fetch(`${this.baseURL}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data;
  }
}

export const crawl4aiClient = new Crawl4AiClient();
