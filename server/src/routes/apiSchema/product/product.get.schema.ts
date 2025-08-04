import { Type } from '@sinclair/typebox';
import { PaginationQuerySchema } from '../shared/pagination.schema';

// Parameters schema for get single product route
export const GetProductParamsSchema = Type.Object({
  id: Type.String({
    description: 'Product ID',
  }),
});

// Query schema for listing products with filtering and pagination
export const GetProductsQuerySchema = Type.Object({
  title: Type.Optional(
    Type.String({
      description: 'Filter by product title (partial match)',
      maxLength: 255,
    })
  ),
  isDefault: Type.Optional(
    Type.Boolean({
      description: 'Filter by default products only',
    })
  ),
  ...PaginationQuerySchema.properties,
});

// Single product response schema
export const ProductResponseSchema = Type.Object({
  id: Type.String({ description: 'Product ID' }),
  title: Type.String({ description: 'Product title' }),
  description: Type.Union([Type.String(), Type.Null()], { description: 'Product description' }),
  salesVoice: Type.Union([Type.String(), Type.Null()], { description: 'Sales voice/pitch' }),
  siteUrl: Type.Union([Type.String(), Type.Null()], { description: 'Product website URL' }),
  isDefault: Type.Boolean({ description: 'Whether this is the default product' }),
  tenantId: Type.String({ description: 'Tenant ID' }),
  createdAt: Type.String({ description: 'Creation timestamp', format: 'date-time' }),
  updatedAt: Type.String({ description: 'Last update timestamp', format: 'date-time' }),
});

// Response schema for getting a single product
export const GetProductResponseSchema = ProductResponseSchema;

// Complete schema for the get single product route
export const ProductGetSchema = {
  params: GetProductParamsSchema,
  response: {
    200: GetProductResponseSchema,
  },
} as const;

// Complete schema for the list products route
export const ProductsListSchema = {
  querystring: GetProductsQuerySchema,
  response: {
    200: Type.Array(ProductResponseSchema, { description: 'Array of products' }),
  },
} as const;
