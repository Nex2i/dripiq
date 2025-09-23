import { Type } from '@sinclair/typebox';

// OTP verification body schema
export const verifyOtpBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  otp: Type.String({ minLength: 6, maxLength: 6 }),
  type: Type.Union([Type.Literal('signup'), Type.Literal('recovery')]),
});

// OTP verification success response schema
export const verifyOtpResponseSchema = Type.Object({
  message: Type.String(),
  redirectUrl: Type.String(),
  session: Type.Optional(
    Type.Object({
      access_token: Type.String(),
      refresh_token: Type.String(),
      expires_in: Type.Number(),
      expires_at: Type.Optional(Type.Number()),
      token_type: Type.String(),
      user: Type.Object({
        id: Type.String(),
        email: Type.String(),
        email_confirmed_at: Type.Optional(Type.String()),
      }),
    })
  ),
});
