import Firecrawl, { type SearchResultWeb, SdkError } from '@mendable/firecrawl-js';
import { createSignedJwt } from '../jwt';
import { IUploadFile } from '../supabase.storage';
import { logger } from '../logger';
import { PageData } from './firecrawl';

class FirecrawlClient {
  private firecrawlApp: Firecrawl;
  private apiUrl: string;
  private firecrawlApiKey: string;

  constructor() {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not set');
    }

    this.firecrawlApp = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    this.apiUrl = process.env.API_URL!;
    this.firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  }

  /**
   * Wraps an async function with Firecrawl error handling
   */
  private async wrapWithErrorHandling<TResult>(
    operation: string,
    fn: () => Promise<TResult>,
    context?: Record<string, any>
  ): Promise<TResult> {
    try {
      return await fn();
    } catch (error) {
      handleFirecrawlError(error, operation, context);
    }
  }

  async batchScrapeUrls(urls: string[], metadata: Record<string, string> = {}) {
    if (urls.length === 0) {
      return;
    }

    if (urls.length === 1) {
      if (!(await this.checkSiteExists(urls[0]))) {
        throw new Error('Site does not exist');
      }
    }

    return this.wrapWithErrorHandling(
      'batch scrape URLs',
      async () => {
        const jwt = createSignedJwt(this.firecrawlApiKey);

        const crawlResult = await this.firecrawlApp.startBatchScrape(urls, {
          options: {
            formats: ['markdown'],
            onlyMainContent: false,
            maxAge: 14400000, // 4 hours in milliseconds
            excludeTags: ['#ad', 'header', 'footer'],
          },
          webhook: {
            url: `${this.apiUrl}/api/firecrawl/webhook`,
            events: ['completed', 'page', 'failed'],
            metadata,
            headers: {
              'x-api-key': jwt,
            },
          },
        });

        return crawlResult;
      },
      { urls, metadata }
    );
  }

  async getSiteMap(url: string): Promise<SearchResultWeb[]> {
    if (!(await this.checkSiteExists(url))) {
      throw new Error('Site does not exist');
    }

    return this.wrapWithErrorHandling(
      'get site map',
      async () => {
        const siteMap = await this.firecrawlApp.map(siteMapOptimizedUrl(url), {
          sitemap: 'include',
          includeSubdomains: false,
          limit: 500,
        });

        return siteMap.links ?? [];
      },
      { url }
    );
  }

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
      slug: `${url.getFullDomain()}/${slug}`,
    };
  }

  cleanMetadata(metadata: Record<string, any>) {
    return {
      title: metadata.title,
      url: metadata.url,
      description: metadata.description,
    };
  }

  async checkSiteExists(url?: string | null): Promise<boolean> {
    if (!url) {
      return false;
    }

    const browserUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    try {
      const response = await fetch(url as string, {
        method: 'GET',
        headers: {
          'User-Agent': browserUserAgent,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return true;
      }

      // Treat protected 4xx (not clear-not-found) as existing
      if (
        response.status >= 400 &&
        response.status < 500 &&
        ![404, 410, 451].includes(response.status)
      ) {
        return true;
      }

      return false;
    } catch (_) {
      return false;
    }
  }
}

// Create singleton instance
const firecrawlClient = new FirecrawlClient();

export default firecrawlClient;

function siteMapOptimizedUrl(url: string): string {
  // Remove protocol (http, https, etc.)
  let domain = url.replace(/^https?:\/\//, '');

  // Remove www.
  domain = domain.replace(/^www\./, '');

  // Split by "/" and take the first part (in case there is a path)
  domain = domain.split('/')[0] ?? '';

  return domain;
}

// Reusable error handling utility for Firecrawl SDK operations
function handleFirecrawlError(
  error: unknown,
  operation: string,
  context?: Record<string, any>
): never {
  let statusCode: number | undefined;
  let errorMessage = 'Unknown error';
  let errorCode: string | undefined;
  let errorDetails: unknown;

  if (error instanceof SdkError) {
    statusCode = error.status;
    errorMessage = error.message;
    errorCode = error.code;
    errorDetails = error.details;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  logger.error(`Error in ${operation}`, {
    error: errorMessage,
    statusCode,
    errorCode,
    errorDetails,
    ...context,
  });

  const errorMsg = statusCode
    ? `Failed to ${operation} (HTTP ${statusCode}): ${errorMessage}`
    : `Failed to ${operation}: ${errorMessage}`;

  throw new Error(errorMsg);
}
