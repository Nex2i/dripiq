import { Type } from '@sinclair/typebox';

// Request body schema for bulk campaign creation
export const BulkCampaignCreateRequestSchema = Type.Object({
  emails: Type.String({
    description: 'Comma-separated list of email addresses',
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+(,[^\\s@]+@[^\\s@]+\\.[^\\s@]+)*$',
  }),
  leadName: Type.String({
    description: 'Name for the new lead to be created',
    minLength: 1,
    maxLength: 255,
  }),
  tenantId: Type.String({
    description: 'ID of the tenant to create the lead for',
  }),
  body: Type.String({
    description: 'Message body for the campaign',
    minLength: 1,
  }),
});

// Individual contact result schema
export const ContactResultSchema = Type.Object({
  id: Type.String({ description: 'Contact ID' }),
  name: Type.String({ description: 'Contact name' }),
  email: Type.String({ description: 'Contact email' }),
  campaignId: Type.Optional(Type.String({ description: 'Created campaign ID' })),
  success: Type.Boolean({ description: 'Whether contact and campaign creation succeeded' }),
  error: Type.Optional(Type.String({ description: 'Error message if creation failed' })),
});

// Response schema for bulk campaign creation
export const BulkCampaignCreateResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  leadId: Type.String({ description: 'Created lead ID' }),
  leadName: Type.String({ description: 'Created lead name' }),
  tenantId: Type.String({ description: 'Tenant ID' }),
  totalEmails: Type.Number({ description: 'Total number of emails processed' }),
  successfulContacts: Type.Number({ description: 'Number of contacts created successfully' }),
  successfulCampaigns: Type.Number({ description: 'Number of campaigns created successfully' }),
  contacts: Type.Array(ContactResultSchema, { description: 'Results for each contact' }),
});

// Error response schema
export const BulkCampaignErrorResponseSchema = Type.Object({
  error: Type.String({ description: 'Error type' }),
  message: Type.String({ description: 'Error message' }),
  details: Type.Optional(Type.Any({ description: 'Additional error details' })),
});

// Complete schema for the bulk campaign create route
export const BulkCampaignCreateSchema = {
  body: BulkCampaignCreateRequestSchema,
  response: {
    201: BulkCampaignCreateResponseSchema,
    400: BulkCampaignErrorResponseSchema,
    401: BulkCampaignErrorResponseSchema,
    500: BulkCampaignErrorResponseSchema,
  },
} as const;
