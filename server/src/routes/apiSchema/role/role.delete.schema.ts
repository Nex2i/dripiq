import { Type } from '@sinclair/typebox';

// Parameters for deleting a role
export const DeleteRoleParamsSchema = Type.Object({
  roleId: Type.String({ description: 'Role ID to delete' }),
});

// Response schema for role deletion
export const DeleteRoleResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  role: Type.Object({
    id: Type.String({ description: 'Deleted role ID' }),
    name: Type.String({ description: 'Deleted role name' }),
    description: Type.Optional(Type.String({ description: 'Deleted role description' })),
  }),
});

// Complete schema for the delete role route
export const RoleDeleteSchema = {
  params: DeleteRoleParamsSchema,
  response: {
    200: DeleteRoleResponseSchema,
  },
} as const;
