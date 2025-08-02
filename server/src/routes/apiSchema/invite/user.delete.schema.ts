import { Type } from '@sinclair/typebox';

// Parameters schema for removing user from tenant
export const DeleteUserParamsSchema = Type.Object({
  userId: Type.String({ description: 'ID of the user to remove from tenant' }),
});

// Response schema for successful user removal
export const DeleteUserResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  data: Type.Object({
    userId: Type.String({ description: 'Removed user ID' }),
    tenantId: Type.String({ description: 'Tenant ID' }),
    removedAt: Type.String({ format: 'date-time', description: 'Removal timestamp' }),
  }),
});

// Complete schema for the delete user route
export const UserDeleteSchema = {
  params: DeleteUserParamsSchema,
  response: {
    200: DeleteUserResponseSchema,
  },
} as const;
