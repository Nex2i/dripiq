import { Type } from '@sinclair/typebox';

// Parameters schema for delete product route
export const DeleteProductParamsSchema = Type.Object({
  id: Type.String({
    description: 'Product ID',
    format: 'uuid',
  }),
});

// Response schema for product deletion (204 No Content)
export const DeleteProductResponseSchema = Type.Object({});

// Complete schema for the delete product route
export const ProductDeleteSchema = {
  params: DeleteProductParamsSchema,
  response: {
    204: DeleteProductResponseSchema,
  },
} as const;
