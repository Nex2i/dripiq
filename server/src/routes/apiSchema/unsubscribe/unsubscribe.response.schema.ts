import { Type } from '@sinclair/typebox';

// Success response for manual unsubscribe
export const UnsubscribeSuccessResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

// Response for checking unsubscribe status
export const UnsubscribeStatusResponseSchema = Type.Object({
  email: Type.String(),
  channel: Type.String(),
  isUnsubscribed: Type.Boolean(),
});

// Unsubscribe statistics response
export const UnsubscribeStatsResponseSchema = Type.Object({
  total: Type.Number({
    description: 'Total number of unsubscribes',
  }),
  byChannel: Type.Record(Type.String(), Type.Number(), {
    description: 'Unsubscribe count by channel',
  }),
  bySource: Type.Record(Type.String(), Type.Number(), {
    description: 'Unsubscribe count by source',
  }),
  recentUnsubscribes: Type.Array(
    Type.Object({
      id: Type.String(),
      channel: Type.String(),
      channelValue: Type.String(),
      unsubscribedAt: Type.String({ format: 'date-time' }),
      unsubscribeSource: Type.String(),
      campaignId: Type.Optional(Type.String()),
      contactId: Type.Optional(Type.String()),
    }),
    {
      description: 'Recent unsubscribe records (last 10)',
    }
  ),
});

// Error response schema
export const UnsubscribeErrorResponseSchema = Type.Object({
  error: Type.String(),
});
