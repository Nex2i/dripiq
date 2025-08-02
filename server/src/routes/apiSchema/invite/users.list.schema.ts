import { Type } from '@sinclair/typebox';
import { PaginationResponseSchema } from '../shared/pagination.schema';

// Schema for individual user in the list
export const UserListItemSchema = Type.Object({
  id: Type.String({ description: 'User ID' }),
  email: Type.String({ description: 'User email address' }),
  name: Type.Optional(Type.String({ description: 'User full name' })),
  firstName: Type.Optional(Type.String({ description: 'User first name' })),
  lastName: Type.Optional(Type.String({ description: 'User last name' })),
  role: Type.Object({
    id: Type.String({ description: 'Role ID' }),
    name: Type.String({ description: 'Role name' }),
  }),
  status: Type.String({ description: 'User status in tenant (active, pending, etc.)' }),
  invitedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Invitation timestamp' })),
  acceptedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Acceptance timestamp' })),
  createdAt: Type.String({ format: 'date-time', description: 'User creation timestamp' }),
});

// Schema for users list response
export const UsersListResponseSchema = Type.Object({
  success: Type.Boolean({ description: 'Indicates successful operation' }),
  data: Type.Array(UserListItemSchema, { description: 'Array of users for the tenant' }),
  pagination: PaginationResponseSchema,
});

// Complete schema for the users list route
export const UsersListSchema = {
  response: {
    200: UsersListResponseSchema,
  },
} as const;