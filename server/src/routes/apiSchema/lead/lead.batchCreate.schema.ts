import { Type } from '@sinclair/typebox';

// Request schema for batch creating leads
export const BatchCreateLeadRequestSchema = Type.Object({
  websites: Type.Array(
    Type.String({
      minLength: 1,
      description: 'Lead website domain (e.g., "example.com")',
    }),
    {
      minItems: 1,
      maxItems: 50, // Reasonable limit for batch operations
      description: 'Array of website domains to create leads from',
    }
  ),
  ownerId: Type.String({
    description: 'User ID to assign as owner for all leads (must be verified)',
  }),
});

// Individual lead result schema
export const BatchCreateLeadResultSchema = Type.Object({
  url: Type.String({ description: 'Original website URL' }),
  success: Type.Boolean({ description: 'Whether the lead was created successfully' }),
  leadId: Type.Optional(Type.String({ description: 'Created lead ID if successful' })),
  error: Type.Optional(Type.String({ description: 'Error message if failed' })),
  name: Type.Optional(Type.String({ description: 'Generated lead name' })),
});

// Response schema for batch lead creation
export const BatchCreateLeadResponseSchema = Type.Object({
  message: Type.String({ description: 'Overall operation message' }),
  results: Type.Array(BatchCreateLeadResultSchema, {
    description: 'Individual results for each website URL',
  }),
  summary: Type.Object({
    total: Type.Number({ description: 'Total number of URLs processed' }),
    successful: Type.Number({ description: 'Number of leads created successfully' }),
    failed: Type.Number({ description: 'Number of failed attempts' }),
  }),
});

// Complete schema for the batch create lead route
export const LeadBatchCreateSchema = {
  body: BatchCreateLeadRequestSchema,
  response: {
    201: BatchCreateLeadResponseSchema,
  },
} as const;
