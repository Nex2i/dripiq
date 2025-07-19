import FirecrawlApp from '@mendable/firecrawl-js';
import { createSignedJwt } from '../jwt';
import { IUploadFile } from '../supabase.storage';
import { PageData } from './firecrawl';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const apiUrl = process.env.API_URL;

const firecrawlClient = {
  crawlUrl: async (url: string, metadata: Record<string, any> = {}) => {
    const jwt = createSignedJwt(process.env.FIRECRAWL_API_KEY ?? '');

    const crawlResult = await app.asyncCrawlUrl(url, {
      limit: 2,
      allowExternalLinks: false,
      allowSubdomains: false,
      deduplicateSimilarURLs: true,
      ignoreQueryParameters: true,
      regexOnFullURL: true,
      crawlEntireDomain: true,
      allowBackwardLinks: true,
      ignoreSitemap: true,
      excludePaths: ['^/blog(?:/.*)?$', '^/support(?:/.*)?$'],
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        parsePDF: false,
        maxAge: 14400000,
      },
      webhook: {
        url: `${apiUrl}/api/firecrawl/webhook/crawl`,
        events: ['completed', 'page', 'failed'],
        metadata,
        headers: {
          'x-api-key': jwt,
        },
      },
    });

    return crawlResult;
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
      slug: slug,
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

export default firecrawlClient;
