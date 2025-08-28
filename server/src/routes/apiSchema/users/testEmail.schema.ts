import { Type } from '@sinclair/typebox';

export const TestEmailRequestSchema = Type.Object({
  recipientEmail: Type.String({
    format: 'email',
    description: 'Email address to send the test email to',
  }),
  subject: Type.String({
    minLength: 1,
    maxLength: 200,
    description: 'Subject line for the test email',
  }),
  body: Type.String({
    minLength: 1,
    maxLength: 50000,
    description: 'HTML body content for the test email',
  }),
});

export const TestEmailResponseSchema = Type.Object({
  success: Type.Boolean({
    description: 'Whether the email was sent successfully',
  }),
  message: Type.String({
    description: 'Success or error message',
  }),
  messageId: Type.Optional(
    Type.String({
      description: 'SendGrid message ID if successful',
    })
  ),
});

export type TestEmailRequest = typeof TestEmailRequestSchema.static;
export type TestEmailResponse = typeof TestEmailResponseSchema.static;
