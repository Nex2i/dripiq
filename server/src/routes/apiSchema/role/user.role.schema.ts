import { Type } from '@sinclair/typebox';

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

// Complete schema for update role route
export const RoleUpdateSchema = {
  params: UpdateRoleParamsSchema,
  body: UpdateRoleRequestSchema,
  response: {
    200: UpdateRoleResponseSchema,
  },
} as const;
