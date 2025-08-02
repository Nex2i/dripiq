import { Type } from '@sinclair/typebox';

// Parameters for getting user permissions
export const UserPermissionsParamsSchema = Type.Object({
  tenantId: Type.String({ description: 'Tenant ID' }),
});

// Response schema for user permissions
export const UserPermissionsResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  userPermissions: Type.Object({
    userId: Type.String({ description: 'User ID' }),
    tenantId: Type.String({ description: 'Tenant ID' }),
    role: Type.Object({
      id: Type.String({ description: 'Role ID' }),
      name: Type.String({ description: 'Role name' }),
      description: Type.Optional(Type.String({ description: 'Role description' })),
    }),
    permissions: Type.Array(Type.Object({
      id: Type.String({ description: 'Permission ID' }),
      name: Type.String({ description: 'Permission name' }),
      description: Type.Optional(Type.String({ description: 'Permission description' })),
      resource: Type.String({ description: 'Resource name' }),
      action: Type.String({ description: 'Action name' }),
    }), { description: 'User permissions' }),
  }),
});

// Parameters for updating a role
export const UpdateRoleParamsSchema = Type.Object({
  roleId: Type.String({ description: 'Role ID to update' }),
});

// Request schema for updating a role (reusing create schema structure)
export const UpdateRoleRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Role name' }),
  description: Type.Optional(Type.String({ description: 'Role description' })),
});

// Response schema for role update
export const UpdateRoleResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  role: Type.Object({
    id: Type.String({ description: 'Role ID' }),
    name: Type.String({ description: 'Role name' }),
    description: Type.Optional(Type.String({ description: 'Role description' })),
    updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  }),
});

// Complete schema for get user permissions route
export const UserPermissionsGetSchema = {
  params: UserPermissionsParamsSchema,
  response: {
    200: UserPermissionsResponseSchema,
  },
} as const;

// Complete schema for update role route
export const RoleUpdateSchema = {
  params: UpdateRoleParamsSchema,
  body: UpdateRoleRequestSchema,
  response: {
    200: UpdateRoleResponseSchema,
  },
} as const;