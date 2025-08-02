import { Type } from '@sinclair/typebox';

// Schema for create user endpoint - used after Supabase signup
export const createUserBodySchema = Type.Object({
  supabaseId: Type.String(),
  email: Type.String({ format: 'email' }),
  name: Type.Optional(Type.String()),
  avatar: Type.Optional(Type.String()),
});

// Response schema for successful user creation
export const createUserResponseSchema = Type.Object({
  message: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.Optional(Type.String()),
    avatar: Type.Optional(Type.String()),
    createdAt: Type.String(),
    updatedAt: Type.String(),
  }),
});
