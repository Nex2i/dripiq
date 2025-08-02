import { Type } from '@sinclair/typebox';
import { PointOfContactResponseSchema } from '../shared/pointOfContact.schema';

// Lead status response schema
export const LeadStatusResponseSchema = Type.Object({
  id: Type.String({ description: 'Status ID' }),
  status: Type.String({
    enum: [
      'Unprocessed',
      'Syncing Site',
      'Scraping Site',
      'Analyzing Site',
      'Extracting Contacts',
      'Processed',
    ],
    description: 'Status value',
  }),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
});

// Complete lead response schema
export const LeadResponseSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
  name: Type.String({ description: 'Lead name' }),
  url: Type.String({ description: 'Lead website URL' }),
  status: Type.String({ description: 'Lead status' }),
  summary: Type.Optional(Type.String({ description: 'Lead summary' })),
  products: Type.Optional(Type.Array(Type.String(), { description: 'Lead products' })),
  services: Type.Optional(Type.Array(Type.String(), { description: 'Lead services' })),
  differentiators: Type.Optional(
    Type.Array(Type.String(), { description: 'Lead differentiators' })
  ),
  targetMarket: Type.Optional(Type.String({ description: 'Lead target market' })),
  tone: Type.Optional(Type.String({ description: 'Lead tone' })),
  logo: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Lead logo URL' })),
  brandColors: Type.Optional(Type.Array(Type.String(), { description: 'Lead brand colors' })),
  primaryContactId: Type.Optional(Type.String({ description: 'Primary contact ID' })),
  ownerId: Type.Optional(Type.String({ description: 'Lead owner ID' })),
  createdAt: Type.String({ format: 'date-time', description: 'Created timestamp' }),
  updatedAt: Type.String({ format: 'date-time', description: 'Updated timestamp' }),
  pointOfContacts: Type.Optional(
    Type.Array(PointOfContactResponseSchema, {
      description: 'Array of point of contacts for the lead',
    })
  ),
  statuses: Type.Optional(
    Type.Array(LeadStatusResponseSchema, {
      description: 'Array of processing statuses for the lead',
    })
  ),
});
