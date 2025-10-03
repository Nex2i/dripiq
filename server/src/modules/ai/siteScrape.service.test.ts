import { SearchResultWeb } from '@mendable/firecrawl-js';
import { SiteScrapeService } from './siteScrape.service';
import { smartUrlFilterAgent } from './langchain';

jest.mock('@/libs/firecrawl/firecrawl.client', () => ({
  __esModule: true,
  default: {
    getSiteMap: jest.fn(),
    batchScrapeUrls: jest.fn(),
  },
}));

jest.mock('./langchain', () => ({
  smartUrlFilterAgent: {
    execute: jest.fn(),
  },
}));

jest.mock('@/libs/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SiteScrapeService.smartFilterSiteMap', () => {
  const createMockUrls = (count: number): SearchResultWeb[] => {
    return Array.from({ length: count }, (_, i) => ({
      url: `https://example.com/page-${i + 1}`,
      title: `Page ${i + 1}`,
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Max limit enforcement', () => {
    it('should enforce max limit of 75 when smart filter returns more than 75 URLs', async () => {
      const mockUrls = createMockUrls(100);
      const mockFilteredUrls = Array.from(
        { length: 90 },
        (_, i) => `https://example.com/page-${i + 1}`
      );

      (smartUrlFilterAgent.execute as jest.Mock).mockResolvedValue(mockFilteredUrls);

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(75);
      expect(result).toEqual(mockFilteredUrls.slice(0, 75));
    });

    it('should enforce max limit of 75 when smart filter fails and falls back', async () => {
      const mockUrls = createMockUrls(398); // Simulate the reported bug scenario

      (smartUrlFilterAgent.execute as jest.Mock).mockRejectedValue(
        new Error('Smart filter failed')
      );

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(75);
      expect(result[0]).toBe('https://example.com/page-1');
      expect(result[74]).toBe('https://example.com/page-75');
    });

    it('should enforce max limit of 75 when smart filter throws exception', async () => {
      const mockUrls = createMockUrls(200);

      (smartUrlFilterAgent.execute as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(75);
    });

    it('should return all URLs when count is below minimum (45)', async () => {
      const mockUrls = createMockUrls(30);

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(30);
      expect(smartUrlFilterAgent.execute).not.toHaveBeenCalled();
    });

    it('should enforce min limit of 45 when smart filter returns fewer URLs', async () => {
      const mockUrls = createMockUrls(100);
      const mockFilteredUrls = Array.from(
        { length: 30 },
        (_, i) => `https://example.com/page-${i + 1}`
      );

      (smartUrlFilterAgent.execute as jest.Mock).mockResolvedValue(mockFilteredUrls);

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      // Should fall back to all input URLs when LLM returns fewer than minimum, but still respect max limit
      expect(result).toHaveLength(75);
      expect(result).toEqual(mockUrls.slice(0, 75).map((u) => u.url));
    });

    it('should return URLs within range when smart filter works correctly', async () => {
      const mockUrls = createMockUrls(100);
      const mockFilteredUrls = Array.from(
        { length: 60 },
        (_, i) => `https://example.com/page-${i + 1}`
      );

      (smartUrlFilterAgent.execute as jest.Mock).mockResolvedValue(mockFilteredUrls);

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(60);
      expect(result).toEqual(mockFilteredUrls);
    });
  });

  describe('Edge cases', () => {
    it('should handle exactly 45 URLs without invoking smart filter', async () => {
      const mockUrls = createMockUrls(45);

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(45);
      expect(smartUrlFilterAgent.execute).not.toHaveBeenCalled();
    });

    it('should handle exactly 75 URLs with smart filter', async () => {
      const mockUrls = createMockUrls(75);
      const mockFilteredUrls = mockUrls.map((u) => u.url);

      (smartUrlFilterAgent.execute as jest.Mock).mockResolvedValue(mockFilteredUrls);

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(75);
      expect(smartUrlFilterAgent.execute).toHaveBeenCalled();
    });

    it('should handle exactly 76 URLs and ensure max limit is enforced on error', async () => {
      const mockUrls = createMockUrls(76);

      (smartUrlFilterAgent.execute as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(75);
    });
  });

  describe('Regression test for 398 pages bug', () => {
    it('should never return more than 75 URLs even when smart filter fails with 398 input URLs', async () => {
      const mockUrls = createMockUrls(398);

      (smartUrlFilterAgent.execute as jest.Mock).mockRejectedValue(
        new Error('Smart filter agent error')
      );

      const result = await SiteScrapeService.smartFilterSiteMap(mockUrls, 'lead_site');

      expect(result).toHaveLength(75);
      expect(result.length).toBeLessThanOrEqual(75);
    });
  });
});
