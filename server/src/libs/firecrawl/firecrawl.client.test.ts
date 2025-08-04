// Mock environment variables before importing
const originalEnv = process.env;
process.env = {
  ...originalEnv,
  FIRECRAWL_API_KEY: 'test-api-key',
  API_URL: 'https://test-api.com',
};

// Mock FirecrawlApp before any imports
const mockAsyncCrawlUrl = jest.fn();
const mockAsyncBatchScrapeUrls = jest.fn();
const mockMapUrl = jest.fn();
const mockScrapeUrl = jest.fn();

jest.mock('@mendable/firecrawl-js', () => {
  return jest.fn().mockImplementation(() => ({
    asyncCrawlUrl: mockAsyncCrawlUrl,
    asyncBatchScrapeUrls: mockAsyncBatchScrapeUrls,
    mapUrl: mockMapUrl,
    scrapeUrl: mockScrapeUrl,
  }));
});

import firecrawlClient from './firecrawl.client';
import { createSignedJwt } from '../jwt';
import '../../extensions/string.extensions';

// Mock JWT creation
jest.mock('../jwt', () => ({
  createSignedJwt: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('firecrawlClient', () => {
  let mockCreateSignedJwt: jest.MockedFunction<typeof createSignedJwt>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockCreateSignedJwt = createSignedJwt as jest.MockedFunction<typeof createSignedJwt>;
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations
    mockCreateSignedJwt.mockReturnValue('test-jwt-token');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('crawlEntireDomain', () => {
    it('should successfully crawl a domain with default metadata', async () => {
      const mockCrawlResult = { id: 'crawl-123', success: true };
      mockAsyncCrawlUrl.mockResolvedValue(mockCrawlResult);

      const result = await firecrawlClient.crawlEntireDomain('https://example.com');

      expect(mockCreateSignedJwt).toHaveBeenCalledWith('test-api-key');
      expect(mockAsyncCrawlUrl).toHaveBeenCalledWith('https://example.com', {
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
          url: 'https://test-api.com/api/firecrawl/webhook',
          events: ['completed', 'page', 'failed'],
          metadata: {},
          headers: {
            'x-api-key': 'test-jwt-token',
          },
        },
      });
      expect(result).toEqual(mockCrawlResult);
    });

    it('should crawl with custom metadata', async () => {
      const mockCrawlResult = { id: 'crawl-456', success: true };
      const customMetadata = { tenantId: '123', leadId: '456' };
      mockAsyncCrawlUrl.mockResolvedValue(mockCrawlResult);

      const result = await firecrawlClient.crawlEntireDomain('https://example.com', customMetadata);

      expect(mockAsyncCrawlUrl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          webhook: expect.objectContaining({
            metadata: customMetadata,
          }),
        })
      );
      expect(result).toEqual(mockCrawlResult);
    });

    it('should handle crawl errors', async () => {
      const error = new Error('Crawl failed');
      mockAsyncCrawlUrl.mockRejectedValue(error);

      await expect(firecrawlClient.crawlEntireDomain('https://example.com')).rejects.toThrow(
        'Crawl failed'
      );
    });
  });

  describe('batchScrapeUrls', () => {
    it('should return early for empty URL array', async () => {
      const result = await firecrawlClient.batchScrapeUrls([]);

      expect(mockAsyncBatchScrapeUrls).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should check site existence for single URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const mockScrapeResult = { id: 'batch-123', success: true };
      mockAsyncBatchScrapeUrls.mockResolvedValue(mockScrapeResult);

      const result = await firecrawlClient.batchScrapeUrls(['https://example.com']);

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DripIQ-Bot/1.0)',
        },
        signal: expect.any(AbortSignal),
      });
      expect(mockAsyncBatchScrapeUrls).toHaveBeenCalled();
      expect(result).toEqual(mockScrapeResult);
    });

    it('should throw error if single URL does not exist', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(firecrawlClient.batchScrapeUrls(['https://nonexistent.com'])).rejects.toThrow(
        'Site does not exist'
      );

      expect(mockAsyncBatchScrapeUrls).not.toHaveBeenCalled();
    });

    it('should successfully scrape multiple URLs without site check', async () => {
      const mockScrapeResult = { id: 'batch-456', success: true };
      mockAsyncBatchScrapeUrls.mockResolvedValue(mockScrapeResult);

      const urls = ['https://example.com', 'https://another.com'];
      const result = await firecrawlClient.batchScrapeUrls(urls);

      expect(mockFetch).not.toHaveBeenCalled(); // No site check for multiple URLs
      expect(mockAsyncBatchScrapeUrls).toHaveBeenCalledWith(
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
          url: 'https://test-api.com/api/firecrawl/webhook',
          events: ['completed', 'page', 'failed'],
          metadata: {},
          headers: {
            'x-api-key': 'test-jwt-token',
          },
        }
      );
      expect(result).toEqual(mockScrapeResult);
    });

    it('should pass through custom metadata', async () => {
      const mockScrapeResult = { id: 'batch-789', success: true };
      const customMetadata = { userId: '123' };
      mockAsyncBatchScrapeUrls.mockResolvedValue(mockScrapeResult);

      const result = await firecrawlClient.batchScrapeUrls(
        ['https://example.com', 'https://another.com'],
        customMetadata
      );

      expect(mockAsyncBatchScrapeUrls).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        undefined,
        expect.objectContaining({
          metadata: customMetadata,
        })
      );
      expect(result).toEqual(mockScrapeResult);
    });
  });

  describe('getSiteMap', () => {
    it('should check site existence before getting sitemap', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const mockSiteMap = {
        success: true,
        links: ['https://example.com/', 'https://example.com/about'],
      };
      mockMapUrl.mockResolvedValue(mockSiteMap);

      const result = await firecrawlClient.getSiteMap('https://www.example.com/path');

      expect(mockFetch).toHaveBeenCalledWith('https://www.example.com/path', expect.any(Object));
      expect(mockMapUrl).toHaveBeenCalledWith('example.com', {
        ignoreSitemap: true,
        includeSubdomains: false,
        limit: 500,
      });
      expect(result).toEqual(['https://example.com/', 'https://example.com/about']);
    });

    it('should throw error if site does not exist', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(firecrawlClient.getSiteMap('https://nonexistent.com')).rejects.toThrow(
        'Site does not exist'
      );

      expect(mockMapUrl).not.toHaveBeenCalled();
    });

    it('should throw error if sitemap request fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const mockSiteMap = {
        success: false,
        error: 'Failed to map site',
      };
      mockMapUrl.mockResolvedValue(mockSiteMap);

      await expect(firecrawlClient.getSiteMap('https://example.com')).rejects.toThrow(
        'Failed to map site'
      );
    });

    it('should handle sitemap with no links', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const mockSiteMap = {
        success: true,
        links: null,
      };
      mockMapUrl.mockResolvedValue(mockSiteMap);

      const result = await firecrawlClient.getSiteMap('https://example.com');

      expect(result).toEqual([]);
    });
  });

  describe('createFirecrawlMarkdownFile', () => {
    it('should create markdown file with correct structure', () => {
      const pageData = {
        markdown: '# Test Page\n\nThis is test content.',
        metadata: {
          url: 'https://example.com/about',
          title: 'About Us',
          description: 'About our company',
          modifiedTime: '2023-01-01T00:00:00Z',
          statusCode: 200,
        },
      };
      const crawlId = 'crawl-123';

      const result = firecrawlClient.createFirecrawlMarkdownFile(crawlId, pageData);

      expect(result.contentType).toBe('text/markdown');
      expect(result.fileName).toBe('example-about.md');
      expect(result.slug).toBe('example/example-about');

      // Verify file content
      expect(result.fileBody).toBeInstanceOf(Blob);
      expect(result.fileBody.type).toBe('text/markdown');
    });

    it('should handle root URL correctly', () => {
      const pageData = {
        markdown: '# Home Page',
        metadata: {
          url: 'https://example.com/',
          title: 'Home',
          description: 'Home page',
          modifiedTime: '2023-01-01T00:00:00Z',
          statusCode: 200,
        },
      };
      const crawlId = 'crawl-456';

      const result = firecrawlClient.createFirecrawlMarkdownFile(crawlId, pageData);

      expect(result.fileName).toBe('example.md');
      expect(result.slug).toBe('example/example');
    });
  });

  describe('cleanMetadata', () => {
    it('should extract only title, url, and description', () => {
      const metadata = {
        title: 'Test Page',
        url: 'https://example.com',
        description: 'A test page',
        extra: 'should be removed',
        internal: 'also removed',
        timestamp: '2023-01-01',
      };

      const result = firecrawlClient.cleanMetadata(metadata);

      expect(result).toEqual({
        title: 'Test Page',
        url: 'https://example.com',
        description: 'A test page',
      });

      // Verify only expected properties exist
      expect(Object.keys(result)).toEqual(['title', 'url', 'description']);
      expect('extra' in result).toBe(false);
      expect('internal' in result).toBe(false);
      expect('timestamp' in result).toBe(false);
    });

    it('should handle missing properties', () => {
      const metadata = {
        title: 'Test Page',
        // url and description missing
      };

      const result = firecrawlClient.cleanMetadata(metadata);

      expect(result).toEqual({
        title: 'Test Page',
        url: undefined,
        description: undefined,
      });
    });
  });

  describe('checkSiteExists', () => {
    it('should return false for null or undefined URL', async () => {
      expect(await firecrawlClient.checkSiteExists(null)).toBe(false);
      expect(await firecrawlClient.checkSiteExists(undefined)).toBe(false);
      expect(await firecrawlClient.checkSiteExists('')).toBe(false);
    });

    it('should return true for successful response (2xx)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const result = await firecrawlClient.checkSiteExists('https://example.com');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DripIQ-Bot/1.0)',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should return true for redirect response (3xx)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 301,
      } as Response);

      const result = await firecrawlClient.checkSiteExists('https://example.com');

      expect(result).toBe(true);
    });

    it('should return false for client error (4xx)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await firecrawlClient.checkSiteExists('https://nonexistent.com');

      expect(result).toBe(false);
    });

    it('should return false for server error (5xx)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await firecrawlClient.checkSiteExists('https://broken.com');

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await firecrawlClient.checkSiteExists('https://unreachable.com');

      expect(result).toBe(false);
    });

    it('should return false for timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('Timeout'));

      const result = await firecrawlClient.checkSiteExists('https://timeout.com');

      expect(result).toBe(false);
    });

    it('should use proper timeout and headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await firecrawlClient.checkSiteExists('https://example.com');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DripIQ-Bot/1.0)',
        },
        signal: expect.any(AbortSignal),
      });
    });
  });
});
