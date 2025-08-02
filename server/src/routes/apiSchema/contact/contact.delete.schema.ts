import { Type } from '@sinclair/typebox';

// Parameters schema for delete contact route
export const DeleteContactParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
  contactId: Type.String({ description: 'Contact ID' }),
});

// Response schema for contact deletion
export const DeleteContactResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
});

// Complete schema for the delete contact route
export const ContactDeleteSchema = {
  params: DeleteContactParamsSchema,
  response: {
    200: DeleteContactResponseSchema,
  },
} as const;
