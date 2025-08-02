import { Type } from '@sinclair/typebox';

// Request schema for updating user role
export const UpdateUserRoleRequestSchema = Type.Object({
  roleId: Type.String({ minLength: 1, description: 'ID of the role to assign to the user' }),
});

// Parameters schema for user role update
export const UpdateUserRoleParamsSchema = Type.Object({
  userId: Type.String({ description: 'ID of the user whose role to update' }),
});

// Response schema for successful user role update
export const UpdateUserRoleResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  userTenant: Type.Object({
    id: Type.String({ description: 'User tenant relationship ID' }),
    userId: Type.String({ description: 'User ID' }),
    tenantId: Type.String({ description: 'Tenant ID' }),
    roleId: Type.String({ description: 'Updated role ID' }),
    status: Type.String({ description: 'User tenant status' }),
  }),
});

// Complete schema for the update user role route
export const UserUpdateRoleSchema = {
  params: UpdateUserRoleParamsSchema,
  body: UpdateUserRoleRequestSchema,
  response: {
    200: UpdateUserRoleResponseSchema,
  },
} as const;
