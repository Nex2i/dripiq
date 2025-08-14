import { Type } from '@sinclair/typebox';
import { LeadResponseSchema } from './lead.response.schema';

// Parameters for assign owner route
export const AssignOwnerParamsSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
});

// Request schema for assigning owner
export const AssignOwnerRequestSchema = Type.Object({
  userId: Type.String({ description: 'User ID to assign as owner (must be verified)' }),
});

// Response schema for assign owner
export const AssignOwnerResponseSchema = Type.Object({
  message: Type.String(),
  lead: LeadResponseSchema,
});

// Complete schema for assign owner route
export const LeadAssignOwnerSchema = {
  params: AssignOwnerParamsSchema,
  body: AssignOwnerRequestSchema,
  response: {
    200: AssignOwnerResponseSchema,
  },
} as const;
