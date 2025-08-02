import { Type } from '@sinclair/typebox';
import { CreateLeadRequestSchema } from './lead.create.schema';
import { LeadResponseSchema } from './lead.response.schema';

// Parameters for updating a lead
export const UpdateLeadParamsSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
});

// Request schema for updating a lead (all fields optional)
export const UpdateLeadRequestSchema = Type.Partial(CreateLeadRequestSchema);

// Response schema for updating a lead
export const UpdateLeadResponseSchema = Type.Object({
  message: Type.String(),
  lead: LeadResponseSchema,
});

// Complete schema for update lead route
export const LeadUpdateSchema = {
  params: UpdateLeadParamsSchema,
  body: UpdateLeadRequestSchema,
  response: {
    200: UpdateLeadResponseSchema,
  },
} as const;
