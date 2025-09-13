import { FastifyInstance, FastifyRequest, RouteOptions } from 'fastify';
import { DashboardService } from '../modules/dashboard.service';
import { AuthenticatedRequest } from '../plugins/authentication.plugin';
import { defaultRouteResponse } from '../types/response';
import { logger } from '../libs/logger';

// Import dashboard schemas
import { DashboardGetSchema } from './apiSchema/dashboard';

const basePath = '/dashboard';

export default async function DashboardRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // GET /dashboard - Get dashboard metrics
  fastify.route({
    method: 'GET',
    preHandler: [fastify.authPrehandler],
    url: basePath,
    schema: {
      ...DashboardGetSchema,
      response: {
        ...defaultRouteResponse(),
        ...DashboardGetSchema.response,
      },
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        const { tenantId } = request as AuthenticatedRequest;

        logger.info(`Getting dashboard metrics for tenant: ${tenantId}`);

        // Get dashboard metrics from service
        const dashboardData = await DashboardService.getDashboardMetrics(tenantId);

        return reply.status(200).send({
          data: dashboardData,
        });
      } catch (error) {
        logger.error('Error getting dashboard metrics:', error);
        return reply.status(500).send({
          error: 'Internal server error',
          message: 'Failed to retrieve dashboard metrics',
        });
      }
    },
  });
}
