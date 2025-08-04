import { Type } from '@sinclair/typebox';

// Request body schema for creating a product
export const CreateProductRequestSchema = Type.Object({
  title: Type.String({
    description: 'Product title',
    minLength: 1,
    maxLength: 255,
  }),
  description: Type.Optional(
    Type.String({
      description: 'Product description',
      maxLength: 1000,
    })
  ),
  salesVoice: Type.Optional(
    Type.String({
      description: 'Sales voice/pitch for the product',
      maxLength: 2000,
    })
  ),
  // format: 'uri',
  siteUrl: Type.Optional(
    Type.String({
      description: 'Product website URL',
    })
  ),
  isDefault: Type.Optional(
    Type.Boolean({
      description: 'Whether this is the default product',
      default: false,
    })
  ),
});

// Response schema for product creation
export const CreateProductResponseSchema = Type.Object({
  id: Type.String({ description: 'Product ID', format: 'string' }),
  title: Type.String({ description: 'Product title' }),
  description: Type.Union([Type.String(), Type.Null()], { description: 'Product description' }),
  salesVoice: Type.Union([Type.String(), Type.Null()], { description: 'Sales voice/pitch' }),
  siteUrl: Type.Union([Type.String(), Type.Null()], { description: 'Product website URL' }),
  isDefault: Type.Boolean({ description: 'Whether this is the default product' }),
  tenantId: Type.String({ description: 'Tenant ID' }),
  createdAt: Type.String({ description: 'Creation timestamp', format: 'date-time' }),
  updatedAt: Type.String({ description: 'Last update timestamp', format: 'date-time' }),
});

// Complete schema for the create product route
export const ProductCreateSchema = {
  body: CreateProductRequestSchema,
  response: {
    201: CreateProductResponseSchema,
  },
} as const;
