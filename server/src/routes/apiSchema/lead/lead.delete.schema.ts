import { Type } from '@sinclair/typebox';
import { LeadResponseSchema } from './lead.response.schema';

// Parameters for deleting a single lead
export const DeleteLeadParamsSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
});

// Response schema for deleting a single lead
export const DeleteLeadResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  deletedLead: LeadResponseSchema,
});

// Request schema for bulk delete
export const BulkDeleteLeadsRequestSchema = Type.Object({
  ids: Type.Array(Type.String(), { minItems: 1, description: 'Array of lead IDs to delete' }),
});

// Response schema for bulk delete
export const BulkDeleteLeadsResponseSchema = Type.Object({
  message: Type.String(),
  deletedLeads: Type.Array(LeadResponseSchema),
});

// Complete schemas for delete operations
export const LeadDeleteSchema = {
  params: DeleteLeadParamsSchema,
  response: {
    200: DeleteLeadResponseSchema,
  },
} as const;

export const LeadBulkDeleteSchema = {
  body: BulkDeleteLeadsRequestSchema,
  response: {
    200: BulkDeleteLeadsResponseSchema,
  },
} as const;
