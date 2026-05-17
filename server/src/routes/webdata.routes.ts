import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { logger } from '@/libs/logger';
import { getWebDataServiceForTenant } from '@/libs/webData';
import '@/extensions/string.extensions';
import { fetchWebDataContacts } from '@/modules/ai/webDataContactHelper';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';

const basePath = '/webdata';

export default async function webdataRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/employees`,
    preHandler: [fastify.authPrehandler],
    schema: {
      description:
        'Get employees by company domain using WebData (ZoomInfo when configured, otherwise CoreSignal)',
      tags: ['WebData'],
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          domainUrl: string;
          isDecisionMaker?: boolean;
          aiFormat?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { tenantId } = request as AuthenticatedRequest;
        const { domainUrl, isDecisionMaker = true, aiFormat = true } = request.body;

        logger.info('WebData employees request', {
          domainUrl,
          isDecisionMaker,
          tenantId,
          requestId: request.id,
        });

        const cleanDomain = domainUrl.getFullDomain();

        if (!cleanDomain) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid domain URL provided',
          });
        }

        if (aiFormat) {
          const webDataAiResult = await fetchWebDataContacts(domainUrl, tenantId);
          return reply.status(200).send({
            success: true,
            data: {
              result: webDataAiResult,
              company_domain: cleanDomain,
              provider: 'ai',
            },
          });
        }

        const webDataService = await getWebDataServiceForTenant(tenantId);

        const result = await webDataService.getEmployeesByCompanyDomain(cleanDomain, {
          isDecisionMaker,
          useCache: true,
          cacheTtl: 3600,
        });

        logger.info('WebData employees response', {
          cleanDomain,
          employeeCount: result.employees.current.length,
          totalCurrent: result.employees.total_current,
          provider: result.provider,
          requestId: request.id,
        });

        return reply.status(200).send({
          success: true,
          data: {
            employees: result.employees.current,
            total_count: result.employees.total_current,
            company_domain: cleanDomain,
            provider: result.provider,
          },
        });
      } catch (error) {
        logger.error('WebData employees error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          requestId: request.id,
        });

        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve employee data',
        });
      }
    },
  });
}
