import { Type } from '@sinclair/typebox';

export const BulkContactsCreateSchema = {
  body: Type.Object({
    emails: Type.String({
      description: 'Comma-separated list of email addresses',
      minLength: 1,
    }),
    leadName: Type.String({
      description: 'The name/identifier of the lead to associate contacts with',
      minLength: 1,
    }),
    tenantId: Type.String({
      description: 'The tenant ID',
      minLength: 1,
    }),
    body: Type.String({
      description: 'The campaign message body content',
      minLength: 1,
    }),
  }),
  headers: Type.Object({
    'x-api-key': Type.String({
      description: 'API key for authentication',
    }),
  }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Object({
        contactsCreated: Type.Number(),
        campaignsCreated: Type.Number(),
        contacts: Type.Array(
          Type.Object({
            id: Type.String(),
            name: Type.String(),
            email: Type.String(),
            leadId: Type.String(),
          })
        ),
        campaigns: Type.Array(
          Type.Object({
            id: Type.String(),
            contactId: Type.String(),
            status: Type.String(),
            channel: Type.String(),
          })
        ),
      }),
    }),
    400: Type.Object({
      error: Type.String(),
      message: Type.String(),
    }),
    401: Type.Object({
      error: Type.String(),
      message: Type.String(),
    }),
    404: Type.Object({
      error: Type.String(),
      message: Type.String(),
    }),
    500: Type.Object({
      error: Type.String(),
      message: Type.String(),
    }),
  },
};
