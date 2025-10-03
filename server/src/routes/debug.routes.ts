import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { cacheManager, cacheTestConnection, cacheInspectRedis } from '@/libs/cache';
import { logger } from '@/libs/logger';
import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { SiteScrapeService } from '@/modules/ai/siteScrape.service';

const basePath = '/debug';

export default async function Debug(fastify: FastifyInstance, _opts: RouteOptions) {
  // Cache test route
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/cache/test`,
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          redis: Type.Object({
            connected: Type.Boolean(),
            setTest: Type.Boolean(),
            getTest: Type.Boolean(),
            error: Type.Optional(Type.String()),
          }),
          timestamp: Type.String(),
        }),
        500: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Test Cache Connection',
      description: 'Test Redis cache connection and basic operations',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const connectionTest = await cacheTestConnection();

        logger.info('Cache test results', connectionTest);

        reply.send({
          success: true,
          redis: connectionTest,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Cache test route error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Cache test failed',
        });
      }
    },
  });

  // Manual cache set/get test
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/cache/manual`,
    schema: {
      body: Type.Object({
        key: Type.String(),
        value: Type.Any(),
        ttl: Type.Optional(Type.Number()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          set: Type.Boolean(),
          get: Type.Boolean(),
          retrievedValue: Type.Any(),
          timestamp: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Manual Cache Test',
      description: 'Manually test cache set and get operations',
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          key: string;
          value: any;
          ttl?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { key, value, ttl } = request.body;

        // Test set
        await cacheManager.set(key, value, { ttl });
        logger.info('Manual cache set', { key, value, ttl });

        // Test get immediately
        const retrievedValue = await cacheManager.get(key);
        logger.info('Manual cache get', { key, retrievedValue });

        reply.send({
          success: true,
          set: true,
          get: retrievedValue !== null,
          retrievedValue,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Manual cache test error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Manual cache test failed',
        });
      }
    },
  });

  // Get cache stats
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/cache/stats`,
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          stats: Type.Any(),
          timestamp: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Get Cache Stats',
      description: 'Get cache statistics and information',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await cacheManager.getStats();

        reply.send({
          success: true,
          stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Cache stats error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Failed to get cache stats',
        });
      }
    },
  });

  // Inspect Redis directly
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/cache/inspect`,
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          inspection: Type.Any(),
          timestamp: Type.String(),
        }),
      },
      tags: ['Debug'],
      summary: 'Inspect Redis',
      description: 'Inspect Redis directly to see what keys exist',
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const inspection = await cacheInspectRedis();

        reply.send({
          success: true,
          inspection,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Redis inspection error', { error: String(error) });
        reply.status(500).send({
          success: false,
          error: error.message || 'Failed to inspect Redis',
        });
      }
    },
  });

  // Test smart filter
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/smart-filter/test`,
    schema: {
      querystring: Type.Object({
        site: Type.String({ description: 'Website URL to test (e.g., https://example.com)' }),
        siteType: Type.Optional(
          Type.Union([Type.Literal('lead_site'), Type.Literal('organization_site')], {
            description: 'Type of site to scrape',
            default: 'lead_site',
          })
        ),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          site: Type.String(),
          siteType: Type.String(),
          sitemap: Type.Object({
            totalUrls: Type.Number(),
            sampleUrls: Type.Array(Type.String()),
          }),
          filtering: Type.Object({
            basicFiltered: Type.Number(),
            smartFiltered: Type.Number(),
            finalUrls: Type.Array(Type.String()),
          }),
          performance: Type.Object({
            sitemapFetchTimeMs: Type.Number(),
            smartFilterTimeMs: Type.Number(),
            totalTimeMs: Type.Number(),
          }),
          skipped: Type.Optional(
            Type.Object({
              reason: Type.String(),
              message: Type.String(),
            })
          ),
          timestamp: Type.String(),
        }),
        400: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
        }),
        500: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
          details: Type.Optional(Type.Any()),
        }),
      },
      tags: ['Debug'],
      summary: 'Test Smart Filter',
      description:
        'Test the smart filter functionality by fetching a sitemap and running the smart filter on it',
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          site: string;
          siteType?: 'lead_site' | 'organization_site';
        };
      }>,
      reply: FastifyReply
    ) => {
      const startTime = Date.now();
      const { site, siteType = 'lead_site' } = request.query;

      try {
        // Validate URL
        try {
          new URL(site);
        } catch {
          return reply.status(400).send({
            success: false,
            error: 'Invalid URL provided',
          });
        }

        logger.info('[Debug] Testing smart filter', { site, siteType });

        // Step 1: Fetch sitemap
        const sitemapStart = Date.now();
        let sitemap = await firecrawlClient.getSiteMap(site);
        const sitemapFetchTimeMs = Date.now() - sitemapStart;

        logger.info('[Debug] Sitemap fetched', {
          site,
          totalUrls: sitemap.length,
          sitemapFetchTimeMs,
        });

        // Step 2: Apply basic filtering
        const basicFiltered = SiteScrapeService.filterUrls(sitemap);

        logger.info('[Debug] Basic filtering applied', {
          site,
          originalCount: sitemap.length,
          basicFilteredCount: basicFiltered.length,
        });

        // Step 3: Apply smart filtering
        const smartFilterStart = Date.now();
        const smartFiltered = await SiteScrapeService.smartFilterSiteMap(basicFiltered, siteType, {
          domain: new URL(site).hostname,
        });
        const smartFilterTimeMs = Date.now() - smartFilterStart;

        logger.info('[Debug] Smart filter applied', {
          site,
          basicFilteredCount: basicFiltered.length,
          smartFilteredCount: smartFiltered.length,
          smartFilterTimeMs,
        });

        const totalTimeMs = Date.now() - startTime;

        // Check if smart filter was skipped
        let skipped;
        if (sitemap.length <= 45) {
          skipped = {
            reason: 'below_minimum',
            message: `Sitemap size (${sitemap.length}) is below minimum (45), smart filter skipped`,
          };
        } else if (basicFiltered.length > 300) {
          skipped = {
            reason: 'above_maximum',
            message: `Sitemap size (${basicFiltered.length}) is above maximum (300), smart filter skipped`,
          };
        }

        reply.send({
          success: true,
          site,
          siteType,
          sitemap: {
            totalUrls: sitemap.length,
            sampleUrls: sitemap.slice(0, 5).map((u) => u.url),
          },
          filtering: {
            basicFiltered: basicFiltered.length,
            smartFiltered: smartFiltered.length,
            finalUrls: smartFiltered,
          },
          performance: {
            sitemapFetchTimeMs,
            smartFilterTimeMs,
            totalTimeMs,
          },
          ...(skipped && { skipped }),
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        const totalTimeMs = Date.now() - startTime;

        logger.error('[Debug] Smart filter test failed', {
          error,
          site,
          siteType,
          totalTimeMs,
        });

        reply.status(500).send({
          success: false,
          error: error.message || 'Smart filter test failed',
          details: {
            name: error.name,
            message: error.message,
            totalTimeMs,
          },
        });
      }
    },
  });
}
