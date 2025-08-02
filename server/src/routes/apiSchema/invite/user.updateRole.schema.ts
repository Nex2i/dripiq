import { Type } from '@sinclair/typebox';

// Request schema for updating user role
export const UpdateUserRoleRequestSchema = Type.Object({
  roleId: Type.String({ minLength: 1, description: 'ID of the role to assign to the user' }),
});

// Parameters schema for user role update
export const UpdateUserRoleParamsSchema = Type.Object({
  userId: Type.String({ description: 'ID of the user whose role to update' }),
});
