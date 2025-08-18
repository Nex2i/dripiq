import { Type } from '@sinclair/typebox';

// Request schema for updating own profile or another user's profile (admin)
export const UpdateProfileRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Full display name for the user' }),
  calendarLink: Type.Optional(
    Type.String({
      description: 'Optional calendar link URL for the user',
      format: 'uri',
    })
  ),
  calendarTieIn: Type.String({ 
    description: 'Introductory text used before presenting the calendar link in emails',
    default: "If you're interested, feel free to grab some time on my calendar"
  }),
});

// Params schema for routes that target a specific user by ID
export const UserIdParamsSchema = Type.Object({
  userId: Type.String({ description: 'Database ID of the user' }),
});
