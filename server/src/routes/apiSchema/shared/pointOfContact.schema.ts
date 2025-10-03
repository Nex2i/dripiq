import { Type } from '@sinclair/typebox';

// Shared point of contact schema for requests
export const PointOfContactSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Contact name' }),
  email: Type.String({ format: 'email', description: 'Contact email address' }),
  phone: Type.Optional(Type.String({ description: 'Contact phone number' })),
  title: Type.Optional(Type.String({ description: 'Contact job title' })),
  company: Type.Optional(Type.String({ description: 'Contact company' })),
});

// Shared point of contact response schema
export const PointOfContactResponseSchema = Type.Object({
  id: Type.String({ description: 'Contact ID' }),
  name: Type.String({ description: 'Contact name' }),
  email: Type.String({ description: 'Contact email' }),
  emailVerificationResult: Type.Optional(
    Type.Union([
      Type.Literal('valid'),
      Type.Literal('invalid'),
      Type.Literal('unknown'),
      Type.Literal('ok_for_all'),
      Type.Literal('inferred'),
    ], { description: 'Email verification result' })
  ),
  phone: Type.Optional(Type.String({ description: 'Contact phone' })),
  title: Type.Optional(Type.String({ description: 'Contact job title' })),
  company: Type.Optional(Type.String({ description: 'Contact company' })),
  sourceUrl: Type.Optional(Type.String({ description: 'URL where contact information was found' })),
  manuallyReviewed: Type.Boolean({ description: 'Whether the contact has been manually reviewed' }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  strategyStatus: Type.Optional(Type.String({ description: 'Strategy status' })),
  isUnsubscribed: Type.Optional(
    Type.Boolean({ description: 'Whether the contact has been unsubscribed' })
  ),
});
