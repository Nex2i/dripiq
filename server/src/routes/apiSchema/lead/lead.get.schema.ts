import { Type } from '@sinclair/typebox';
import { LeadResponseSchema } from './lead.response.schema';

// Query parameters for getting leads
export const GetLeadsQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ description: 'Search term to filter leads' })),
  page: Type.Optional(
    Type.Number({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  ),
  limit: Type.Optional(
    Type.Number({ description: 'Number of leads per page', minimum: 1, maximum: 500, default: 10 })
  ),
});

// Response schema for getting all leads with pagination metadata
export const GetLeadsResponseSchema = Type.Object({
  leads: Type.Array(LeadResponseSchema, {
    description: 'List of leads for the tenant',
  }),
  pagination: Type.Object({
    page: Type.Number({ description: 'Current page number' }),
    limit: Type.Number({ description: 'Number of leads per page' }),
    total: Type.Number({ description: 'Total number of leads' }),
    totalPages: Type.Number({ description: 'Total number of pages' }),
  }),
});

// Parameters for getting a single lead
export const GetLeadParamsSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
});

// Response schema for getting a single lead (returns lead directly)
export const GetLeadResponseSchema = LeadResponseSchema;

// Complete schema for get leads routes
export const LeadGetAllSchema = {
  querystring: GetLeadsQuerySchema,
  response: {
    200: GetLeadsResponseSchema,
  },
} as const;

export const LeadGetByIdSchema = {
  params: GetLeadParamsSchema,
  response: {
    200: GetLeadResponseSchema,
  },
} as const;
