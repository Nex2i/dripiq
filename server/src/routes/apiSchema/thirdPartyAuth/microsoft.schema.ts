import { Type } from '@sinclair/typebox';

// Microsoft OAuth authorization URL response schema
export const microsoftAuthUrlResponseSchema = Type.Object({
  authUrl: Type.String(),
  state: Type.String(),
});

// Microsoft OAuth callback query parameters schema
export const microsoftCallbackQuerySchema = Type.Object({
  code: Type.String(),
  state: Type.String(),
  scope: Type.Optional(Type.String()),
});

// Microsoft OAuth callback response schema
export const microsoftCallbackResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  userData: Type.Optional(
    Type.Object({
      id: Type.String(),
      displayName: Type.String(),
      mail: Type.Optional(Type.String()),
      userPrincipalName: Type.String(),
      givenName: Type.Optional(Type.String()),
      surname: Type.Optional(Type.String()),
    })
  ),
});

// Note: errorResponseSchema is imported from google.schema to avoid duplication
