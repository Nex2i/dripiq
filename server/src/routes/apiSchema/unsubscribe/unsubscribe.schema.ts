import { Type } from '@sinclair/typebox';

// Query parameters for unsubscribe link
export const UnsubscribeQuerySchema = Type.Object({
  email: Type.String({
    format: 'email',
    description: 'Email address to unsubscribe',
  }),
  tenant: Type.String({
    description: 'Tenant ID',
  }),
  campaign: Type.Optional(
    Type.String({
      description: 'Campaign ID (optional)',
    })
  ),
});

// Request body for manual unsubscribe
export const ManualUnsubscribeRequestSchema = Type.Object({
  email: Type.String({
    format: 'email',
    description: 'Email address to unsubscribe',
  }),
  tenantId: Type.String({
    description: 'Tenant ID',
  }),
  source: Type.Optional(
    Type.String({
      default: 'manual',
      description: 'Source of unsubscribe',
    })
  ),
});

// Query parameters for checking unsubscribe status
export const UnsubscribeStatusQuerySchema = Type.Object({
  email: Type.String({
    format: 'email',
    description: 'Email address to check',
  }),
  channel: Type.Optional(
    Type.String({
      default: 'email',
      description: 'Communication channel',
    })
  ),
});

// Query parameters for unsubscribe statistics
export const UnsubscribeStatsQuerySchema = Type.Object({
  channel: Type.Optional(
    Type.String({
      description: 'Filter by communication channel',
    })
  ),
});