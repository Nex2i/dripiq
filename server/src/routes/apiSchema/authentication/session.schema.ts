import { Type } from '@sinclair/typebox';

// Login body schema
export const loginBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String(),
});

// Session info response schema (for /auth endpoint)
export const sessionInfoResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  email_confirmed_at: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  confirmed_at: Type.Optional(Type.String()),
  last_sign_in_at: Type.Optional(Type.String()),
  app_metadata: Type.Object({}),
  user_metadata: Type.Object({}),
  identities: Type.Array(Type.Any()),
  created_at: Type.String(),
  updated_at: Type.String(),
});

// Refresh token request schema
export const refreshTokenBodySchema = Type.Object({
  refresh_token: Type.String(),
});

// Refresh token response schema
export const refreshTokenResponseSchema = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  expires_in: Type.Number(),
  token_type: Type.String(),
  user: sessionInfoResponseSchema,
});
