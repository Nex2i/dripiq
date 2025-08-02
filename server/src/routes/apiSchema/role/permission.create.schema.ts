import { Type } from '@sinclair/typebox';

// Request schema for creating a permission
export const CreatePermissionRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Permission name' }),
  description: Type.Optional(Type.String({ description: 'Permission description' })),
  resource: Type.String({ minLength: 1, description: 'Resource name' }),
  action: Type.String({ minLength: 1, description: 'Action name' }),
});

// Response schema for permission creation
export const CreatePermissionResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  permission: Type.Object({
    id: Type.String({ description: 'Permission ID' }),
    name: Type.String({ description: 'Permission name' }),
    description: Type.Optional(Type.String({ description: 'Permission description' })),
    resource: Type.String({ description: 'Resource name' }),
    action: Type.String({ description: 'Action name' }),
    createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
    updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  }),
});

// Complete schema for the create permission route
export const PermissionCreateSchema = {
  body: CreatePermissionRequestSchema,
  response: {
    201: CreatePermissionResponseSchema,
  },
} as const;