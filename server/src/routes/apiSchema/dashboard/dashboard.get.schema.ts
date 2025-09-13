import { DashboardResponseSchema } from './dashboard.response.schema';

export const DashboardGetSchema = {
  summary: 'Get Dashboard Metrics',
  description: 'Retrieve dashboard metrics and statistics for the current tenant',
  tags: ['Dashboard'],
  response: {
    200: DashboardResponseSchema,
  },
};
