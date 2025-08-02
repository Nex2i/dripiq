import { Type } from '@sinclair/typebox';

// Parameters schema for getting invite details
export const GetInviteParamsSchema = Type.Object({
  inviteId: Type.String({ description: 'ID of the invite to retrieve' }),
});

// Response schema for invite details
export const GetInviteResponseSchema = Type.Object({
  success: Type.Boolean({ description: 'Indicates successful operation' }),
  data: Type.Object({
    id: Type.String({ description: 'Invite ID' }),
    email: Type.String({ description: 'Email of the invited user' }),
    firstName: Type.String({ description: 'First name of the invited user' }),
    lastName: Type.Optional(Type.String({ description: 'Last name of the invited user' })),
    role: Type.String({ description: 'Role name for the invited user' }),
    status: Type.String({ description: 'Status of the invitation' }),
    tenantId: Type.String({ description: 'Tenant ID' }),
    invitedAt: Type.String({ format: 'date-time', description: 'Invitation timestamp' }),
    expiresAt: Type.Optional(Type.String({ format: 'date-time', description: 'Invite expiration timestamp' })),
  }),
});

// Complete schema for the get invite route
export const InviteGetSchema = {
  params: GetInviteParamsSchema,
  response: {
    200: GetInviteResponseSchema,
  },
} as const;