import { Type } from '@sinclair/typebox';
import { PointOfContactResponseSchema } from '../shared/pointOfContact.schema';

// Parameters schema for get contact by ID route
export const GetContactParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
  contactId: Type.String({ description: 'Contact ID' }),
});

// Response schema for getting a single contact
export const GetContactResponseSchema = Type.Object({
  contact: PointOfContactResponseSchema,
});

// Complete schema for the get contact route
export const ContactGetSchema = {
  params: GetContactParamsSchema,
  response: {
    200: GetContactResponseSchema,
  },
} as const;
