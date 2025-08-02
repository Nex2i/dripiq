import { Type } from '@sinclair/typebox';

// Response schema for a single permission
export const PermissionResponseSchema = Type.Object({
  id: Type.String({ description: 'Permission ID' }),
  name: Type.String({ description: 'Permission name' }),
  description: Type.Optional(Type.String({ description: 'Permission description' })),
  resource: Type.String({ description: 'Resource name' }),
  action: Type.String({ description: 'Action name' }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

// Response schema for getting all permissions
export const GetPermissionsResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  permissions: Type.Array(PermissionResponseSchema, { description: 'List of permissions' }),
});

// Complete schema for get permissions route
export const PermissionGetAllSchema = {
  response: {
    200: GetPermissionsResponseSchema,
  },
} as const;
