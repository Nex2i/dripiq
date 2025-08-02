import { Type } from '@sinclair/typebox';

// Schema for registration endpoint - handles user and tenant creation
export const registerBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  name: Type.String(),
  tenantName: Type.String(),
});

// Response schema for successful registration
export const registerSuccessResponseSchema = Type.Object({
  message: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.String(),
  }),
  tenant: Type.Object({
    id: Type.String(),
    name: Type.String(),
  }),
  session: Type.Optional(Type.Any()), // Supabase session object
});

// Response schema for registration without auto sign-in
export const registerWithoutSignInResponseSchema = Type.Object({
  message: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.String(),
  }),
  tenant: Type.Object({
    id: Type.String(),
    name: Type.String(),
  }),
});
