import { PaginationQuerySchema } from '../shared/pagination.schema';

// Query parameters for users list endpoint
export const UsersQuerySchema = PaginationQuerySchema;

// TypeScript type for users query
export type UsersQuery = {
  page?: number;
  limit?: number;
};
