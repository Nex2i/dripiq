import { Type } from '@sinclair/typebox';
import { LeadResponseSchema } from './lead.response.schema';

// Query parameters for getting leads
export const GetLeadsQuerySchema = Type.Object({
  search: Type.Optional(Type.String({ description: 'Search term to filter leads' })),
});

// Response schema for getting all leads
export const GetLeadsResponseSchema = Type.Array(LeadResponseSchema, {
  description: 'List of leads for the tenant',
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
