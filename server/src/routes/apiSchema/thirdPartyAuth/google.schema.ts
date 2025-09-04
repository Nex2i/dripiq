import { Type } from '@sinclair/typebox';

// Google OAuth authorization URL response schema
export const googleAuthUrlResponseSchema = Type.Object({
  authUrl: Type.String(),
  state: Type.String(),
});

// Google OAuth callback query parameters schema
export const googleCallbackQuerySchema = Type.Object({
  code: Type.String(),
  state: Type.String(),
  scope: Type.Optional(Type.String()),
});

// Google OAuth callback response schema
export const googleCallbackResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  userData: Type.Optional(
    Type.Object({
      id: Type.String(),
      email: Type.String(),
      name: Type.Optional(Type.String()),
      picture: Type.Optional(Type.String()),
      verified_email: Type.Optional(Type.Boolean()),
    })
  ),
});

// Google disconnect response schema
export const googleDisconnectResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

// Error response schema
export const errorResponseSchema = Type.Object({
  message: Type.String(),
  error: Type.Optional(Type.String()),
});
