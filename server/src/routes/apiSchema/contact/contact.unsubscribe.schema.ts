import { Type } from '@sinclair/typebox';

export const ContactUnsubscribeSchema = {
  params: Type.Object({
    leadId: Type.String({ description: 'The ID of the lead' }),
    contactId: Type.String({ description: 'The ID of the contact to unsubscribe' }),
  }),
  response: {
    200: Type.Object({
      message: Type.String({ description: 'Success message' }),
      unsubscribed: Type.Boolean({
        description: 'Whether the contact was successfully unsubscribed',
      }),
    }),
    400: Type.Object({
      message: Type.String({ description: 'Error message' }),
      error: Type.String({ description: 'Detailed error information' }),
    }),
    403: Type.Object({
      message: Type.String({ description: 'Access denied message' }),
      error: Type.String({ description: 'Detailed error information' }),
    }),
    404: Type.Object({
      message: Type.String({ description: 'Not found message' }),
      error: Type.String({ description: 'Detailed error information' }),
    }),
    500: Type.Object({
      message: Type.String({ description: 'Internal server error message' }),
      error: Type.String({ description: 'Detailed error information' }),
    }),
  },
};
