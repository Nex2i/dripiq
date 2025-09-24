import { Type } from '@sinclair/typebox';

/**
 * Email validation request schema
 */
export const emailValidationRequestSchema = Type.Object({
  email: Type.String({
    format: 'email',
    description: 'Email address to validate',
    examples: ['user@example.com', 'john.doe@gmail.com'],
  }),
});

/**
 * Email validation response schema
 */
export const emailValidationResponseSchema = Type.Object({
  email: Type.String({
    description: 'The email address that was validated',
  }),
  status: Type.Union([Type.Literal('valid'), Type.Literal('invalid'), Type.Literal('unknown')], {
    description: 'Overall validation status of the email',
  }),
  sub_status: Type.Union([Type.String(), Type.Null()], {
    description: 'Detailed sub-status (e.g., disposable, role_based, no_mx_record)',
  }),
  free_email: Type.Boolean({
    description: 'Whether this is a free email provider (Gmail, Yahoo, etc.)',
  }),
  did_you_mean: Type.Union([Type.String(), Type.Null()], {
    description: 'Suggested correction for typos in domain',
  }),
  account: Type.String({
    description: 'The account/username part of the email (before @)',
  }),
  domain: Type.String({
    description: 'The domain part of the email (after @)',
  }),
  domain_age_days: Type.Union([Type.Number(), Type.Null()], {
    description: 'Estimated age of the domain in days',
  }),
  smtp_provider: Type.Union([Type.String(), Type.Null()], {
    description: 'SMTP provider (google, microsoft, yahoo, etc.)',
  }),
  mx_found: Type.Boolean({
    description: 'Whether MX records were found for the domain',
  }),
  mx_record: Type.Union([Type.String(), Type.Null()], {
    description: 'Primary MX record for the domain',
  }),
  firstname: Type.Union([Type.String(), Type.Null()], {
    description: 'Extracted first name (if detectable from email)',
  }),
  lastname: Type.Union([Type.String(), Type.Null()], {
    description: 'Extracted last name (if detectable from email)',
  }),
});

/**
 * Error response schema for email validation
 */
export const emailValidationErrorResponseSchema = Type.Object({
  error: Type.String({
    description: 'Error message',
  }),
  statusCode: Type.Number({
    description: 'HTTP status code',
  }),
});

/**
 * Email validation query schema (for GET requests)
 */
export const emailValidationQuerySchema = Type.Object({
  email: Type.String({
    format: 'email',
    description: 'Email address to validate',
    examples: ['user@example.com'],
  }),
});
