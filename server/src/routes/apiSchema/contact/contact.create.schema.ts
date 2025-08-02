import { Type } from '@sinclair/typebox';
import {
  PointOfContactSchema,
  PointOfContactResponseSchema,
} from '../shared/pointOfContact.schema';

// Parameters schema for create contact route
export const CreateContactParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
});

// Request body schema for creating a contact (uses shared schema)
export const CreateContactRequestSchema = PointOfContactSchema;

// Response schema for contact creation
export const CreateContactResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  contact: PointOfContactResponseSchema,
});

// Complete schema for the create contact route
export const ContactCreateSchema = {
  params: CreateContactParamsSchema,
  body: CreateContactRequestSchema,
  response: {
    201: CreateContactResponseSchema,
  },
} as const;
