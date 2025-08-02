import { Type } from '@sinclair/typebox';

// Request schema for creating an invite
export const CreateInviteRequestSchema = Type.Object({
  email: Type.String({ format: 'email', description: 'Email address of the user to invite' }),
  firstName: Type.String({ minLength: 1, maxLength: 50, description: 'First name of the user' }),
  lastName: Type.Optional(Type.String({ maxLength: 50, description: 'Last name of the user' })),
  role: Type.String({ minLength: 1, description: 'Role name from database for the invited user' }),
});

// Response schema for successful invite creation
export const CreateInviteResponseSchema = Type.Object({
  success: Type.Boolean({ description: 'Indicates successful operation' }),
  message: Type.String({ description: 'Success message' }),
  data: Type.Optional(
    Type.Object({
      id: Type.String({ description: 'Invite or user tenant ID' }),
      email: Type.String({ description: 'Email of the invited user' }),
      status: Type.String({ description: 'Status of the invitation' }),
      invitedAt: Type.Optional(
        Type.String({ format: 'date-time', description: 'Invitation timestamp' })
      ),
    })
  ),
});

// Complete schema for the create invite route
export const InviteCreateSchema = {
  body: CreateInviteRequestSchema,
  response: {
    201: CreateInviteResponseSchema,
  },
} as const;
