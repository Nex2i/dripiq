import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import { FireCrawlWebhookPayload } from '@/libs/firecrawl/firecrawl';
import { SiteAnalyzerService } from '@/modules/ai/siteAnalyzer.service';
import { firecrawlJobStore } from '@/libs/firecrawl/firecrawl.job.store';
import { Guid } from '@/utils/Guid';

const basePath = '/firecrawl';

// Schema for webhook response
const webhookResponseSchema = Type.Object({
  success: Type.Boolean({ description: 'Whether the webhook was processed successfully' }),
  message: Type.String({ description: 'Response message' }),
  jobId: Type.String({ description: 'The Firecrawl job ID' }),
  event: Type.String({ description: 'The processed event type' }),
});

export default async function FirecrawlWebhookRoutes(
  fastify: FastifyInstance,
  _opts: RouteOptions
) {
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/webhook/crawl`,
    schema: {
      description: 'Firecrawl webhook endpoint for receiving crawl events',
      tags: ['Webhooks'],
      summary: 'Handle Firecrawl webhook events',
      //   body: webhookEventSchema,
      response: {
        ...defaultRouteResponse(),
        200: webhookResponseSchema,
        401: Type.Object({
          error: Type.String({ description: 'Error type' }),
          message: Type.String({ description: 'Error message' }),
        }),
        500: Type.Object({
          error: Type.String({ description: 'Error type' }),
          message: Type.String({ description: 'Error message' }),
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: FireCrawlWebhookPayload;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { type, id, data, metadata } = request.body as FireCrawlWebhookPayload;

        // Validate required fields
        if (!type || !id || !crawlMetadataIsValid(metadata)) {
          reply.status(400).send({
            message: 'Missing required fields',
            error: 'Event and jobId are required',
          });
          return;
        }

        // Handle different event types
        switch (type) {
          case 'crawl.completed':
            await firecrawlJobStore.markComplete(id);
            await SiteAnalyzerService.completeFirecrawlCrawl(request.body);
            break;

          case 'crawl.page':
            const pageId = Guid();
            firecrawlJobStore.receivePage(id, pageId);
            await SiteAnalyzerService.analyzePageFromFirecrawl(request.body);
            firecrawlJobStore.completePage(id, pageId);
            break;

          case 'crawl.failed':
            logger.error(`Crawl job ${id} encountered an error`, { data });
            // TODO: Handle crawl errors
            // - Update job status to failed
            // - Store error details
            // - Notify administrators
            break;

          default:
            logger.warn(`Unknown webhook event type: ${type} for job: ${id}`);
            reply.status(400).send({
              error: 'Bad Request',
              message: `Unknown event type: ${type}`,
            });
            return;
        }

        reply.status(200).send({
          success: true,
          message: `Webhook event '${type}' processed successfully`,
          jobId: id,
          event: type,
        });
      } catch (error: any) {
        fastify.log.error(`Error processing Firecrawl webhook: ${error.message}`, {
          error: error instanceof Error ? error.stack : JSON.stringify(error),
          requestBody: request.body,
        });

        reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to process webhook event',
        });
      }
    },
  });
}

function crawlMetadataIsValid(metadata?: Record<string, any>) {
  return metadata && metadata.type && metadata.tenantId;
}
