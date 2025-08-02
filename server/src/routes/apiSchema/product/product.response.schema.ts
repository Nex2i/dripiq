import { Type } from '@sinclair/typebox';

// Base product response schema that can be reused across different endpoints
export const ProductResponseSchema = Type.Object({
  id: Type.String({ description: 'Product ID', format: 'uuid' }),
  title: Type.String({ description: 'Product title' }),
  description: Type.Union([Type.String(), Type.Null()], { description: 'Product description' }),
  salesVoice: Type.Union([Type.String(), Type.Null()], {
    description: 'Sales voice/pitch for the product',
  }),
  siteUrl: Type.Union([Type.String(), Type.Null()], { description: 'Product website URL' }),
  isDefault: Type.Boolean({ description: 'Whether this is the default product' }),
  tenantId: Type.String({ description: 'Tenant ID' }),
  createdAt: Type.String({ description: 'Creation timestamp', format: 'date-time' }),
  updatedAt: Type.String({ description: 'Last update timestamp', format: 'date-time' }),
});

// Minimal product response schema for listings
export const ProductSummaryResponseSchema = Type.Object({
  id: Type.String({ description: 'Product ID', format: 'uuid' }),
  title: Type.String({ description: 'Product title' }),
  isDefault: Type.Boolean({ description: 'Whether this is the default product' }),
  tenantId: Type.String({ description: 'Tenant ID' }),
});

// Error response schemas
export const ProductNotFoundResponseSchema = Type.Object({
  message: Type.String({ description: 'Error message' }),
});

export const ProductAccessDeniedResponseSchema = Type.Object({
  message: Type.String({ description: 'Access denied message' }),
});

export const ProductServerErrorResponseSchema = Type.Object({
  message: Type.String({ description: 'Error message' }),
  error: Type.String({ description: 'Error details' }),
});
