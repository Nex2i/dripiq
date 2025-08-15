import { Type } from '@sinclair/typebox';

// Common user object schema
export const userObjectSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.Optional(Type.String()),
  avatar: Type.Optional(Type.String()),
  calendarLink: Type.Optional(Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

// Tenant with role information schema
export const tenantWithRoleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  isSuperUser: Type.Boolean(),
  role: Type.Optional(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      permissions: Type.Array(Type.String()),
    })
  ),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

// Current user response schema (for /auth/me endpoint)
export const currentUserResponseSchema = Type.Object({
  user: userObjectSchema,
  tenants: Type.Array(tenantWithRoleSchema),
  supabaseUser: Type.Object({
    id: Type.String(),
    email: Type.String(),
    emailConfirmed: Type.Boolean(),
  }),
});

// Logout response schema
export const logoutResponseSchema = Type.Object({
  message: Type.String(),
});

// Error response schema
export const errorResponseSchema = Type.Object({
  message: Type.String(),
  error: Type.Optional(Type.String()),
});
