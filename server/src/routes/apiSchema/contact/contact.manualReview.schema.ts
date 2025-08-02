import { Type } from '@sinclair/typebox';
import { PointOfContactResponseSchema } from '../shared/pointOfContact.schema';

// Parameters schema for toggle manual review route
export const ManualReviewContactParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
  contactId: Type.String({ description: 'Contact ID' }),
});

// Request body schema for toggling manually reviewed status
export const ManualReviewContactRequestSchema = Type.Object({
  manuallyReviewed: Type.Boolean({ description: 'Manually reviewed status' }),
});

// Response schema for manual review toggle
export const ManualReviewContactResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  contact: PointOfContactResponseSchema,
});

// Complete schema for the manual review toggle route
export const ContactManualReviewSchema = {
  params: ManualReviewContactParamsSchema,
  body: ManualReviewContactRequestSchema,
  response: {
    200: ManualReviewContactResponseSchema,
  },
} as const;
