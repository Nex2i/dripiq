import FirecrawlApp from '@mendable/firecrawl-js';
import { createSignedJwt } from '../jwt';
import { IUploadFile } from '../supabase.storage';
import { PageData } from './firecrawl';

const firecrawlApp = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const apiUrl = process.env.API_URL;
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

if (!firecrawlApiKey) {
  throw new Error('FIRECRAWL_API_KEY is not set');
}

const firecrawlClient = {
  crawlEntireDomain: async (url: string, metadata: Record<string, any> = {}) => {
    const jwt = createSignedJwt(firecrawlApiKey);

    const crawlResult = await firecrawlApp.asyncCrawlUrl(url, {
      limit: 50,
      allowExternalLinks: false,
      allowSubdomains: false,
      deduplicateSimilarURLs: true,
      ignoreQueryParameters: true,
      regexOnFullURL: true,
      allowBackwardLinks: true,
      ignoreSitemap: true,
      maxDepth: 3,
      excludePaths: [
        '^/blog(?:/.*)?$',
        '^/support(?:/.*)?$',
        '^/privacy(?:-policy)?(?:/.*)?$',
        '^/terms(?:-of-(service|use|conditions))?(?:/.*)?$',
        '^/(careers?|jobs)(?:/.*)?$',
      ],
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        parsePDF: false,
        maxAge: 14400000,
        excludeTags: ['#ad', '#footer'],
      },
      webhook: {
        url: `${apiUrl}/api/firecrawl/webhook`,
        events: ['completed', 'page', 'failed'],
        metadata,
        headers: {
          'x-api-key': jwt,
        },
      },
    });

    return crawlResult;
  },
  batchScrapeUrls: async (urls: string[], metadata: Record<string, any> = {}) => {
    if (urls.length === 0) {
      return;
    }

    if (urls.length === 1) {
      if (!(await firecrawlClient.checkSiteExists(urls[0]))) {
        throw new Error('Site does not exist');
      }
    }

    const jwt = createSignedJwt(firecrawlApiKey);

    const crawlResult = await firecrawlApp.asyncBatchScrapeUrls(
      urls,
      {
        formats: ['markdown'],
        onlyMainContent: false,
        parsePDF: false,
        maxAge: 14400000,
        excludeTags: ['#ad', 'header', 'footer'],
      },
      undefined,
      {
        url: `${apiUrl}/api/firecrawl/webhook`,
        events: ['completed', 'page', 'failed'],
        metadata,
        headers: {
          'x-api-key': jwt,
        },
      }
    );

    return crawlResult;
  },
  getSiteMap: async (url: string): Promise<string[]> => {
    if (!(await firecrawlClient.checkSiteExists(url))) {
      throw new Error('Site does not exist');
    }

    const siteMap = await firecrawlApp.mapUrl(siteMapOptimizedUrl(url), {
      ignoreSitemap: true,
      includeSubdomains: false,
      limit: 500,
    });

    if (!siteMap.success) {
      throw new Error(siteMap.error ?? 'Failed to get site map');
    }

    return siteMap.links ?? [];
  },
  createFirecrawlMarkdownFile(crawlId: string, pageData: PageData): IUploadFile {
    const { markdown, metadata } = pageData;
    const { url } = metadata;

    const slug = url.getUrlSlug();

    return {
      fileBody: new Blob(
        [markdown.concat('\n' + JSON.stringify(metadata)).concat('\n' + crawlId)],
        {
          type: 'text/markdown',
        }
      ),
      contentType: 'text/markdown',
      fileName: `${slug}.md`,
      slug: `${url.getDomain()}/${slug}`,
    };
  },
  cleanMetadata: (metadata: Record<string, any>) => {
    return {
      title: metadata.title,
      url: metadata.url,
      description: metadata.description,
    };
  },
  checkSiteExists: async (url?: string | null): Promise<boolean> => {
    if (!url) {
      return false;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DripIQ-Bot/1.0)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      // Consider any 2xx or 3xx status code as existing
      return response.ok || (response.status >= 300 && response.status < 400);
    } catch (error) {
      // If any error occurs (network, timeout, etc.), consider the site as not existing/accessible
      return false;
    }
  },
};

function siteMapOptimizedUrl(url: string): string {
  // Remove protocol (http, https, etc.)
  let domain = url.replace(/^https?:\/\//, '');

  // Remove www.
  domain = domain.replace(/^www\./, '');

  // Split by "/" and take the first part (in case there is a path)
  domain = domain.split('/')[0] ?? '';

  return domain;
}

export default firecrawlClient;
