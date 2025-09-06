import { Type } from '@sinclair/typebox';

// Shared email provider object schema
export const EmailProviderSchema = Type.Object({
  id: Type.String({
    description: 'Unique identifier of the mail account',
  }),
  provider: Type.String({
    description: 'Provider name (e.g., google, microsoft)',
  }),
  primaryEmail: Type.String({
    format: 'email',
    description: 'Primary email address for this provider',
  }),
  displayName: Type.String({
    description: 'Display name for the provider account',
  }),
  isPrimary: Type.Boolean({
    description: 'Whether this provider is set as primary for sending emails',
  }),
  isConnected: Type.Boolean({
    description: 'Whether the provider is currently connected and active',
  }),
  connectedAt: Type.String({
    format: 'date-time',
    description: 'ISO timestamp when the provider was connected',
  }),
});

// GET /me/email-providers response schema
export const GetEmailProvidersResponseSchema = Type.Object({
  providers: Type.Array(EmailProviderSchema, {
    description: 'List of connected email providers for the user',
  }),
});

// PUT /me/email-providers/primary request schema
export const SwitchPrimaryProviderRequestSchema = Type.Object({
  providerId: Type.String({
    description: 'ID of the mail account to set as primary',
    minLength: 1,
  }),
});

// PUT /me/email-providers/primary response schema
export const SwitchPrimaryProviderResponseSchema = Type.Object({
  message: Type.String({
    description: 'Success message',
  }),
  provider: EmailProviderSchema,
});

// TypeScript types
export type EmailProvider = typeof EmailProviderSchema.static;
export type GetEmailProvidersResponse = typeof GetEmailProvidersResponseSchema.static;
export type SwitchPrimaryProviderRequest = typeof SwitchPrimaryProviderRequestSchema.static;
export type SwitchPrimaryProviderResponse = typeof SwitchPrimaryProviderResponseSchema.static;
