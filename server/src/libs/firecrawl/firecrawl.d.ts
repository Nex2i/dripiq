export interface FireCrawlWebhookPayload {
  success: boolean;
  type: string;
  id: string;
  data: PageData[];
  metadata: Record<string, any>;
}

export interface PageData {
  markdown: string;
  metadata: PageMetadata;
}

export interface PageMetadata {
  title: string;
  modifiedTime: string;
  'og:site_name'?: string;
  generator?: string;
  'og:url'?: string;
  'msapplication-TileImage'?: string;
  'article:modified_time'?: string;
  ogSiteName?: string;
  ogLocale?: string;
  'twitter:card'?: string;
  ogDescription?: string;
  'og:description'?: string;
  ogUrl?: string;
  'og:locale'?: string;
  'og:title'?: string;
  language?: string;
  description?: string;
  'og:type'?: string;
  viewport?: string;
  robots?: string;
  ogTitle?: string;
  favicon?: string;
  scrapeId?: string;
  sourceURL?: string;
  url: string;
  statusCode: number;
  proxyUsed?: string;
  cacheState?: string;
  cachedAt?: string;
  creditsUsed?: number;
}
