import { Type } from '@sinclair/typebox';

// Request schema for creating an invite
export const CreateInviteRequestSchema = Type.Object({
  email: Type.String({ format: 'email', description: 'Email address of the user to invite' }),
  firstName: Type.String({ minLength: 1, maxLength: 50, description: 'First name of the user' }),
  lastName: Type.Optional(Type.String({ maxLength: 50, description: 'Last name of the user' })),
  role: Type.String({ minLength: 1, description: 'Role name from database for the invited user' }),
});
