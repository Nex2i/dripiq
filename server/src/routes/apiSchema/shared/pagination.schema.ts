import { Type } from '@sinclair/typebox';

// Reusable pagination query schema
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1, description: 'Page number' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25, description: 'Items per page' })),
});

// Reusable pagination response schema
export const PaginationResponseSchema = Type.Object({
  page: Type.Integer({ description: 'Current page number' }),
  limit: Type.Integer({ description: 'Items per page' }),
  total: Type.Integer({ description: 'Total number of items' }),
  totalPages: Type.Integer({ description: 'Total number of pages' }),
});