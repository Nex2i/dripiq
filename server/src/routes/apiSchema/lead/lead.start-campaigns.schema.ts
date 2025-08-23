import type { FastifySchema } from 'fastify';

export const LeadStartCampaignsSchema: FastifySchema = {
  params: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Lead ID',
      },
    },
    required: ['id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Success message',
        },
        leadId: {
          type: 'string',
          description: 'ID of the lead',
        },
        results: {
          type: 'object',
          properties: {
            total: {
              type: 'number',
              description: 'Total number of contacts in the lead',
            },
            started: {
              type: 'number',
              description: 'Number of campaigns started',
            },
            skipped: {
              type: 'number',
              description: 'Number of contacts skipped (already have campaigns)',
            },
            failed: {
              type: 'number',
              description: 'Number of contacts that failed to start campaigns',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contactId: {
                    type: 'string',
                    description: 'Contact ID',
                  },
                  contactName: {
                    type: 'string',
                    description: 'Contact name',
                  },
                  status: {
                    type: 'string',
                    enum: ['started', 'skipped', 'failed'],
                    description: 'Status of campaign start attempt',
                  },
                  reason: {
                    type: 'string',
                    description: 'Reason for skipping or failure',
                  },
                  campaignId: {
                    type: 'string',
                    description: 'Campaign ID if started successfully',
                  },
                },
                required: ['contactId', 'contactName', 'status'],
              },
            },
          },
          required: ['total', 'started', 'skipped', 'failed', 'details'],
        },
      },
      required: ['message', 'leadId', 'results'],
    },
    400: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Error message',
        },
        error: {
          type: 'string',
          description: 'Error details',
        },
      },
      required: ['message'],
    },
    403: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Access denied message',
        },
        error: {
          type: 'string',
          description: 'Error details',
        },
      },
      required: ['message'],
    },
    404: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Lead not found message',
        },
        error: {
          type: 'string',
          description: 'Error details',
        },
      },
      required: ['message'],
    },
    500: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Internal server error message',
        },
        error: {
          type: 'string',
          description: 'Error details',
        },
      },
      required: ['message'],
    },
  },
};
