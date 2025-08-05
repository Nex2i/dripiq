import { Type } from '@sinclair/typebox';

// Parameters schema for update product route
export const UpdateProductParamsSchema = Type.Object({
  id: Type.String({
    description: 'Product ID',
  }),
});

// Request body schema for updating a product (all fields optional)
export const UpdateProductRequestSchema = Type.Object({
  title: Type.Optional(
    Type.String({
      description: 'Product title',
      minLength: 1,
      maxLength: 255,
    })
  ),
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
    })
  ),
});

// Response schema for product update
export const UpdateProductResponseSchema = Type.Object({
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

// Complete schema for the update product route
export const ProductUpdateSchema = {
  params: UpdateProductParamsSchema,
  body: UpdateProductRequestSchema,
  response: {
    200: UpdateProductResponseSchema,
  },
} as const;
