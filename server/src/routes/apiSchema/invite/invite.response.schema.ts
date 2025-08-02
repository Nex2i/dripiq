import { Type } from '@sinclair/typebox';

// Schema for invite activation request
export const ActivateInviteRequestSchema = Type.Object({
  supabaseId: Type.String({ description: 'Supabase user ID for account activation' }),
});

// Schema for resend invite parameters
export const ResendInviteParamsSchema = Type.Object({
  userId: Type.String({ description: 'ID of the user to resend invite to' }),
});
