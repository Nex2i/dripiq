import { Type } from '@sinclair/typebox';

// Parameters for assigning permission to role
export const AssignPermissionParamsSchema = Type.Object({
  roleId: Type.String({ description: 'Role ID to assign permission to' }),
});

// Request schema for assigning permission to role
export const AssignPermissionRequestSchema = Type.Object({
  permissionId: Type.String({ minLength: 1, description: 'Permission ID to assign' }),
});

// Parameters for removing permission from role
export const RemovePermissionParamsSchema = Type.Object({
  roleId: Type.String({ description: 'Role ID to remove permission from' }),
  permissionId: Type.String({ description: 'Permission ID to remove' }),
});

// Response schema for permission assignment
export const AssignPermissionResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  rolePermission: Type.Object({
    roleId: Type.String({ description: 'Role ID' }),
    permissionId: Type.String({ description: 'Permission ID' }),
    assignedAt: Type.String({ format: 'date-time', description: 'Assignment timestamp' }),
  }),
});

// Response schema for permission removal
export const RemovePermissionResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
});

// Complete schema for assign permission to role route
export const PermissionAssignSchema = {
  params: AssignPermissionParamsSchema,
  body: AssignPermissionRequestSchema,
  response: {
    201: AssignPermissionResponseSchema,
  },
} as const;

// Complete schema for remove permission from role route
export const PermissionRemoveSchema = {
  params: RemovePermissionParamsSchema,
  response: {
    200: RemovePermissionResponseSchema,
  },
} as const;
