import { Type } from '@sinclair/typebox';

// Parameters for product detachment
export const DetachProductParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
  productId: Type.String({ description: 'Product ID to detach' }),
});

// Response schema for product detachment
export const DetachProductResponseSchema = Type.Object({
  success: Type.Boolean({ description: 'Whether the operation was successful' }),
  message: Type.String({ description: 'Success message' }),
});

// Complete schema for detach product route
export const LeadDetachProductSchema = {
  params: DetachProductParamsSchema,
  response: {
    200: DetachProductResponseSchema,
  },
} as const;
