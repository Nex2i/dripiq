import { SearchResultWeb } from '@mendable/firecrawl-js';
import { SiteScrapeService } from '../siteScrape.service';
import { getLangfuseClient } from '../langchain/config/langfuse.config';
import { promptManagementService } from '../langchain/services/promptManagement.service';
import { smartFilterTracingService } from '../langchain/services/smartFilterTracing.service';

// Mock langfuse package before any imports
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn(),
    getPrompt: jest.fn(),
    shutdownAsync: jest.fn(),
  })),
}));

// Mock dependencies - Must be before imports that use them
jest.mock('@/libs/logger');
jest.mock('@/libs/firecrawl/firecrawl.client', () => ({
  default: {
    getSiteMap: jest.fn(),
    batchScrapeUrls: jest.fn(),
  },
}));
jest.mock('../langchain/config/langfuse.config');
jest.mock('../langchain/services/promptManagement.service');
jest.mock('../langchain/services/smartFilterTracing.service');

// Mock langchain config with proper structure
jest.mock('../langchain/config/langchain.config', () => ({
  createChatModel: jest.fn(() => ({
    withStructuredOutput: jest.fn(() => ({
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          urls: Array.from({ length: 50 }, (_, i) => `https://example.com/page-${i}`),
        }),
      }),
    })),
  })),
}));

describe('SmartFilter Integration with LangFuse', () => {
  const mockSiteMap: SearchResultWeb[] = Array.from({ length: 50 }, (_, i) => ({
    url: `https://example.com/page-${i}`,
    title: `Page ${i}`,
  }));

  const mockPrompt = {
    name: 'smart_filter',
    version: 1,
    compile: jest.fn((vars) => {
      return `Mock compiled prompt with ${Object.keys(vars).length} variables`;
    }),
  };

  const mockTrace = {
    id: 'trace-123',
    generation: jest.fn().mockReturnValue({
      end: jest.fn(),
    }),
    update: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock LangFuse client
    (getLangfuseClient as jest.Mock).mockReturnValue({
      trace: jest.fn().mockReturnValue(mockTrace),
      getPrompt: jest.fn().mockResolvedValue(mockPrompt),
    });

    // Mock prompt management service
    (promptManagementService.fetchPrompt as jest.Mock).mockResolvedValue(mockPrompt);

    // Mock tracing service
    (smartFilterTracingService.createTrace as jest.Mock).mockReturnValue(mockTrace);
    (smartFilterTracingService.createGeneration as jest.Mock).mockReturnValue({
      end: jest.fn(),
    });
    (smartFilterTracingService.endGeneration as jest.Mock).mockImplementation(() => {});
    (smartFilterTracingService.recordResult as jest.Mock).mockImplementation(() => {});
    (smartFilterTracingService.recordError as jest.Mock).mockImplementation(() => {});
  });

  describe('smartFilterSiteMap', () => {
    it('should skip filtering when sitemap is below minimum threshold', async () => {
      const smallSiteMap = mockSiteMap.slice(0, 40); // Below 45 minimum

      const result = await SiteScrapeService.smartFilterSiteMap(smallSiteMap, 'lead_site');

      expect(result).toHaveLength(40);
      expect(result).toEqual(smallSiteMap.map((url) => url.url));
      expect(promptManagementService.fetchPrompt).not.toHaveBeenCalled();
    });

    it('should create trace with correct metadata', async () => {
      const options = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        domain: 'example.com',
        sessionId: 'session-789',
      };

      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'organization_site', options);

      expect(smartFilterTracingService.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          userId: 'user-456',
          domain: 'example.com',
          sessionId: 'session-789',
          siteType: 'organization_site',
          inputUrlCount: 50,
          minUrls: 45,
          maxUrls: 75,
        })
      );
    });

    it('should fetch prompt from LangFuse with caching', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(promptManagementService.fetchPrompt).toHaveBeenCalledWith('smart_filter', {
        cacheTtlSeconds: 300,
      });
    });

    it('should compile prompt with correct variables', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(mockPrompt.compile).toHaveBeenCalledWith(
        expect.objectContaining({
          urls: expect.any(String),
          output_schema: expect.any(String),
          min_urls: '45',
          max_urls: '75',
          site_type: 'lead_site',
        })
      );
    });

    it('should create generation span for LLM call', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'organization_site');

      expect(smartFilterTracingService.createGeneration).toHaveBeenCalledWith(
        mockTrace,
        expect.any(String),
        'gpt-5-nano'
      );
    });

    it('should record successful result with metrics', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(smartFilterTracingService.recordResult).toHaveBeenCalledWith(
        mockTrace,
        expect.objectContaining({
          success: true,
          outputUrlCount: expect.any(Number),
          executionTimeMs: expect.any(Number),
          promptVersion: 1,
        })
      );
    });

    it('should handle errors and record them in trace', async () => {
      const error = new Error('LLM call failed');
      (promptManagementService.fetchPrompt as jest.Mock).mockRejectedValueOnce(error);

      const result = await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      // Should fallback to all URLs
      expect(result).toHaveLength(50);
      expect(result).toEqual(mockSiteMap.map((url) => url.url));

      // Should record error in trace
      expect(smartFilterTracingService.recordError).toHaveBeenCalledWith(mockTrace, error);
      expect(smartFilterTracingService.recordResult).toHaveBeenCalledWith(
        mockTrace,
        expect.objectContaining({
          success: false,
          error: 'LLM call failed',
          usedFallback: true,
        })
      );
    });

    it('should handle missing LangFuse credentials gracefully', async () => {
      (getLangfuseClient as jest.Mock).mockImplementationOnce(() => {
        throw new Error('LangFuse credentials not configured');
      });

      const result = await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      // Should fallback to all URLs
      expect(result).toHaveLength(50);
      expect(result).toEqual(mockSiteMap.map((url) => url.url));
    });

    it('should end generation span with output', async () => {
      const mockGeneration = { end: jest.fn() };
      (smartFilterTracingService.createGeneration as jest.Mock).mockReturnValue(mockGeneration);

      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(smartFilterTracingService.endGeneration).toHaveBeenCalledWith(
        mockGeneration,
        expect.any(String)
      );
    });

    it('should handle both lead_site and organization_site types', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');
      expect(mockPrompt.compile).toHaveBeenCalledWith(
        expect.objectContaining({ site_type: 'lead_site' })
      );

      jest.clearAllMocks();
      (promptManagementService.fetchPrompt as jest.Mock).mockResolvedValue(mockPrompt);
      (smartFilterTracingService.createTrace as jest.Mock).mockReturnValue(mockTrace);

      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'organization_site');
      expect(mockPrompt.compile).toHaveBeenCalledWith(
        expect.objectContaining({ site_type: 'organization_site' })
      );
    });
  });

  describe('Observability and Tracing', () => {
    it('should track execution time', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(smartFilterTracingService.recordResult).toHaveBeenCalledWith(
        mockTrace,
        expect.objectContaining({
          executionTimeMs: expect.any(Number),
        })
      );

      const recordedResult = (smartFilterTracingService.recordResult as jest.Mock).mock.calls[0][1];
      expect(recordedResult.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include prompt version in trace', async () => {
      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(smartFilterTracingService.recordResult).toHaveBeenCalledWith(
        mockTrace,
        expect.objectContaining({
          promptVersion: 1,
        })
      );
    });

    it('should mark usedFallback flag when returning all URLs', async () => {
      const error = new Error('Prompt fetch failed');
      (promptManagementService.fetchPrompt as jest.Mock).mockRejectedValueOnce(error);

      await SiteScrapeService.smartFilterSiteMap(mockSiteMap, 'lead_site');

      expect(smartFilterTracingService.recordResult).toHaveBeenCalledWith(
        mockTrace,
        expect.objectContaining({
          usedFallback: true,
        })
      );
    });
  });
});
