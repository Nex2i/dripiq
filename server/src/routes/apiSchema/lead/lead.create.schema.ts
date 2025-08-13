import { Type } from '@sinclair/typebox';
import { PointOfContactSchema } from '../shared/pointOfContact.schema';

// Request schema for creating a lead
export const CreateLeadRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Lead name' }),
  url: Type.String({ format: 'uri', minLength: 1, description: 'Lead website URL' }),
  status: Type.Optional(
    Type.String({
      enum: ['new', 'contacted', 'qualified', 'lost'],
      default: 'new',
      description: 'Lead status',
    })
  ),
  ownerId: Type.String({
    description: 'User ID to assign as owner at creation (must be verified)',
  }),
  pointOfContacts: Type.Optional(
    Type.Array(PointOfContactSchema, {
      description: 'Array of point of contacts for the lead',
    })
  ),
});

// Response schema for lead creation
export const CreateLeadResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  lead: Type.Object({
    id: Type.String({ description: 'Lead ID' }),
    name: Type.String({ description: 'Lead name' }),
    url: Type.String({ description: 'Lead URL' }),
    status: Type.String({ description: 'Lead status' }),
    createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
    updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  }),
});

// Complete schema for the create lead route
export const LeadCreateSchema = {
  body: CreateLeadRequestSchema,
  response: {
    201: CreateLeadResponseSchema,
  },
} as const;
