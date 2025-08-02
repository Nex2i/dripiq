import { Type } from '@sinclair/typebox';

// Parameters for getting lead products
export const GetLeadProductsParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID to get products for' }),
});

// Schema for product details in response
export const ProductDetailSchema = Type.Object({
  id: Type.String({ description: 'Product ID' }),
  title: Type.String({ description: 'Product title' }),
  description: Type.Optional(Type.String({ description: 'Product description' })),
  salesVoice: Type.Optional(Type.String({ description: 'Product sales voice' })),
  siteUrl: Type.Optional(Type.String({ description: 'Product site URL' })),
  tenantId: Type.String({ description: 'Tenant ID' }),
});

// Schema for lead-product attachment with product details
export const LeadProductWithDetailsSchema = Type.Object({
  id: Type.String({ description: 'Lead-Product attachment ID' }),
  leadId: Type.String({ description: 'Lead ID' }),
  productId: Type.String({ description: 'Product ID' }),
  attachedAt: Type.String({
    format: 'date-time',
    description: 'When the product was attached',
  }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  product: ProductDetailSchema,
});

// Response schema for getting lead products
export const GetLeadProductsResponseSchema = Type.Array(LeadProductWithDetailsSchema, {
  description: 'List of products attached to the lead',
});

// Complete schema for get lead products route
export const LeadGetProductsSchema = {
  params: GetLeadProductsParamsSchema,
  response: {
    200: GetLeadProductsResponseSchema,
  },
} as const;
