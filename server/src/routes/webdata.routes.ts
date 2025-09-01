import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { defaultRouteResponse } from '@/types/response';
import { logger } from '@/libs/logger';
import { getWebDataService } from '@/libs/webData';
import '@/extensions/string.extensions';
import { WebDataEmployeesRequestSchema, WebDataEmployeesResponseSchema } from './apiSchema/webdata';

const basePath = '/webdata';

export default async function webdataRoutes(fastify: FastifyInstance) {
  // Get employees by company domain
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/employees`,
    schema: {
      description: 'Get employees by company domain using CoreSignal multi-source data',
      tags: ['WebData'],
      ...WebDataEmployeesRequestSchema,
      response: {
        ...defaultRouteResponse,
        ...WebDataEmployeesResponseSchema.response,
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          domainUrl: string;
          isDecisionMaker?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { domainUrl, isDecisionMaker = true } = request.body;

        logger.info('WebData employees request', {
          domainUrl,
          isDecisionMaker,
          requestId: request.id,
        });

        // Clean the domain URL
        const cleanDomain = domainUrl.getFullDomain();

        if (!cleanDomain) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid domain URL provided',
          });
        }

        // Get the webData service
        const webDataService = getWebDataService();

        // Search for employees by domain
        const result = await webDataService.getEmployeesByCompanyDomain(cleanDomain, {
          isDecisionMaker,
          useCache: true,
          cacheTtl: 3600, // 1 hour cache
        });

        logger.info('WebData employees response', {
          cleanDomain,
          employeeCount: result.employees.current.length,
          totalCurrent: result.employees.total_current,
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
