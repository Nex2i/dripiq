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
  // Debug endpoint to check job status
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/job/:jobId/status`,
    schema: {
      description: 'Get Firecrawl job status for debugging',
      tags: ['Webhooks', 'Debug'],
      summary: 'Get job processing status',
      params: Type.Object({
        jobId: Type.String({ description: 'The Firecrawl job ID' }),
      }),
      response: {
        ...defaultRouteResponse(),
        200: Type.Object({
          jobId: Type.String(),
          exists: Type.Boolean(),
          status: Type.Optional(Type.Object({
            receivedPages: Type.Number(),
            processingPages: Type.Number(),
            completed: Type.Boolean(),
            hasTimeout: Type.Boolean(),
          })),
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: { jobId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { jobId } = request.params;
      const jobStatus = firecrawlJobStore.getJobStatus(jobId);

      if (!jobStatus) {
        reply.status(404).send({
          error: 'Not Found',
          message: `Job ${jobId} not found`,
        });
        return;
      }

      reply.status(200).send({
        jobId,
        exists: true,
        status: {
          receivedPages: jobStatus.receivedPages.size,
          processingPages: jobStatus.processingPages.size,
          completed: jobStatus.completed,
          hasTimeout: jobStatus.timeout !== null,
        },
      });
    },
  });

  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/webhook`,
    schema: {
      description: 'Firecrawl webhook endpoint for receiving crawl events',
      tags: ['Webhooks'],
      summary: 'Handle Firecrawl webhook events',
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

        const pageId = Guid();

        // Handle different event types
        switch (type.split('.')[1]) {
          case 'completed':
            await firecrawlJobStore.markComplete(id);
            await SiteAnalyzerService.completeFirecrawlCrawl(request.body);
            break;

          case 'page':
            firecrawlJobStore.receivePage(id, pageId);
            await SiteAnalyzerService.analyzePageFromFirecrawl(request.body);
            firecrawlJobStore.completePage(id, pageId);
            break;

          case 'failed':
            logger.error(`Crawl job ${id} encountered an error`, { data });
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
