import { Type } from '@sinclair/typebox';

// Parameters for product attachment
export const AttachProductsParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID to attach products to' }),
});

// Request schema for attaching products
export const AttachProductsRequestSchema = Type.Object({
  productIds: Type.Array(Type.String(), {
    description: 'Array of product IDs to attach to the lead',
    minItems: 1,
  }),
});

// Schema for product attachment record
export const ProductAttachmentSchema = Type.Object({
  id: Type.String({ description: 'Attachment ID' }),
  leadId: Type.String({ description: 'Lead ID' }),
  productId: Type.String({ description: 'Product ID' }),
  attachedAt: Type.String({
    format: 'date-time',
    description: 'When the product was attached',
  }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

// Response schema for product attachment
export const AttachProductsResponseSchema = Type.Object({
  success: Type.Boolean({ description: 'Whether the operation was successful' }),
  message: Type.String({ description: 'Success message' }),
  attachedCount: Type.Number({ description: 'Number of products attached' }),
  attachments: Type.Array(ProductAttachmentSchema, {
    description: 'List of created attachments',
  }),
});

// Complete schema for attach products route
export const LeadAttachProductsSchema = {
  params: AttachProductsParamsSchema,
  body: AttachProductsRequestSchema,
  response: {
    201: AttachProductsResponseSchema,
  },
} as const;
