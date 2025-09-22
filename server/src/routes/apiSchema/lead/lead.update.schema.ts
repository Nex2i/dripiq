import { Type } from '@sinclair/typebox';
import { LeadResponseSchema } from './lead.response.schema';

// Parameters for updating a lead
export const UpdateLeadParamsSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
});

// Enhanced request schema for updating a lead (all fields optional, includes full lead data)
export const UpdateLeadRequestSchema = Type.Partial(
  Type.Object({
    // Basic lead fields from creation
    name: Type.String({ minLength: 1, description: 'Lead name' }),
    url: Type.String({ format: 'uri', minLength: 1, description: 'Lead website URL' }),
    status: Type.String({
      enum: ['new', 'contacted', 'qualified', 'lost'],
      description: 'Lead status',
    }),

    // Additional editable fields
    summary: Type.Optional(Type.String({ description: 'Lead summary' })),
    products: Type.Optional(Type.Array(Type.String(), { description: 'Lead products' })),
    services: Type.Optional(Type.Array(Type.String(), { description: 'Lead services' })),
    differentiators: Type.Optional(
      Type.Array(Type.String(), { description: 'Lead differentiators' })
    ),
    targetMarket: Type.Optional(Type.String({ description: 'Lead target market' })),
    tone: Type.Optional(Type.String({ description: 'Lead tone' })),
    brandColors: Type.Optional(
      Type.Array(Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }), {
        description: 'Lead brand colors (hex codes)',
      })
    ),
  })
);

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
