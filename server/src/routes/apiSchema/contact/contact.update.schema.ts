import { Type } from '@sinclair/typebox';
import { PointOfContactResponseSchema } from '../shared/pointOfContact.schema';

// Parameters schema for update contact route
export const UpdateContactParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
  contactId: Type.String({ description: 'Contact ID' }),
});

// Request body schema for updating a contact (all fields optional except validation constraints)
export const UpdateContactRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, description: 'Contact name' })),
  email: Type.Optional(Type.String({ format: 'email', description: 'Contact email address' })),
  phone: Type.Optional(
    Type.Union([Type.String({ description: 'Contact phone number' }), Type.Null()])
  ),
  title: Type.Optional(
    Type.Union([Type.String({ description: 'Contact job title' }), Type.Null()])
  ),
});

// Response schema for contact update
export const UpdateContactResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  contact: PointOfContactResponseSchema,
});

// Complete schema for the update contact route
export const ContactUpdateSchema = {
  params: UpdateContactParamsSchema,
  body: UpdateContactRequestSchema,
  response: {
    200: UpdateContactResponseSchema,
  },
} as const;
