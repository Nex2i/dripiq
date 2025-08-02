import { Type } from '@sinclair/typebox';

// Parameters for getting a single role
export const GetRoleParamsSchema = Type.Object({
  roleId: Type.String({ description: 'Role ID' }),
});

// Response schema for a single role with permissions
export const RoleResponseSchema = Type.Object({
  id: Type.String({ description: 'Role ID' }),
  name: Type.String({ description: 'Role name' }),
  description: Type.Optional(Type.String({ description: 'Role description' })),
  permissions: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.String({ description: 'Permission ID' }),
        name: Type.String({ description: 'Permission name' }),
        description: Type.Optional(Type.String({ description: 'Permission description' })),
        resource: Type.String({ description: 'Resource name' }),
        action: Type.String({ description: 'Action name' }),
      }),
      { description: 'Role permissions' }
    )
  ),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

// Response schema for getting all roles
export const GetRolesResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  roles: Type.Array(RoleResponseSchema, { description: 'List of roles' }),
});

// Response schema for getting a single role
export const GetRoleResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  role: RoleResponseSchema,
});

// Complete schema for get roles routes
export const RoleGetAllSchema = {
  response: {
    200: GetRolesResponseSchema,
  },
} as const;

export const RoleGetByIdSchema = {
  params: GetRoleParamsSchema,
  response: {
    200: GetRoleResponseSchema,
  },
} as const;
