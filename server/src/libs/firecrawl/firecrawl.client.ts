import FirecrawlApp, { MapResponse } from '@mendable/firecrawl-js';
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
    const jwt = createSignedJwt(firecrawlApiKey);

    const crawlResult = await firecrawlApp.asyncBatchScrapeUrls(
      urls,
      {
        formats: ['markdown'],
        onlyMainContent: true,
        parsePDF: false,
        maxAge: 14400000,
        excludeTags: ['#ad', '#footer'],
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
