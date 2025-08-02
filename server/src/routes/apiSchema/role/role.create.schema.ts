import { Type } from '@sinclair/typebox';

// Request schema for creating a role
export const CreateRoleRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Role name' }),
  description: Type.Optional(Type.String({ description: 'Role description' })),
});

// Response schema for role creation
export const CreateRoleResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  role: Type.Object({
    id: Type.String({ description: 'Role ID' }),
    name: Type.String({ description: 'Role name' }),
    description: Type.Optional(Type.String({ description: 'Role description' })),
    createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
    updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  }),
});

// Complete schema for the create role route
export const RoleCreateSchema = {
  body: CreateRoleRequestSchema,
  response: {
    201: CreateRoleResponseSchema,
  },
} as const;
