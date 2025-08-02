import { Type } from '@sinclair/typebox';

// Schema for invite activation request
export const ActivateInviteRequestSchema = Type.Object({
  supabaseId: Type.String({ description: 'Supabase user ID for account activation' }),
});

// Schema for invite activation response
export const ActivateInviteResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  userTenant: Type.Object({
    id: Type.String({ description: 'User tenant relationship ID' }),
    tenantId: Type.String({ description: 'Tenant ID' }),
    roleId: Type.String({ description: 'Role ID' }),
    status: Type.String({ description: 'User tenant status' }),
    acceptedAt: Type.String({ format: 'date-time', description: 'Acceptance timestamp' }),
  }),
});

// Schema for resend invite parameters
export const ResendInviteParamsSchema = Type.Object({
  userId: Type.String({ description: 'ID of the user to resend invite to' }),
});

// Schema for resend invite response
export const ResendInviteResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  userTenant: Type.Object({
    id: Type.String({ description: 'User tenant relationship ID' }),
    userId: Type.String({ description: 'User ID' }),
    tenantId: Type.String({ description: 'Tenant ID' }),
    status: Type.String({ description: 'User tenant status' }),
    invitedAt: Type.String({ format: 'date-time', description: 'Invitation timestamp' }),
  }),
});

// Complete schemas for invite operations
export const InviteActivateSchema = {
  body: ActivateInviteRequestSchema,
  response: {
    200: ActivateInviteResponseSchema,
  },
} as const;

export const InviteResendSchema = {
  params: ResendInviteParamsSchema,
  response: {
    200: ResendInviteResponseSchema,
  },
} as const;