import { Type } from '@sinclair/typebox';

// Dashboard metrics response schema
export const DashboardMetricsSchema = Type.Object({
  leads: Type.Object({
    total: Type.Number({ description: 'Total number of leads' }),
    thisWeek: Type.Number({ description: 'New leads added this week' }),
    thisMonth: Type.Number({ description: 'New leads added this month' }),
    byStatus: Type.Record(Type.String(), Type.Number(), {
      description: 'Lead count by status',
    }),
    assigned: Type.Number({ description: 'Number of assigned leads' }),
    unassigned: Type.Number({ description: 'Number of unassigned leads' }),
  }),
  campaigns: Type.Object({
    total: Type.Number({ description: 'Total number of campaigns' }),
    active: Type.Number({ description: 'Number of active campaigns' }),
    byStatus: Type.Record(Type.String(), Type.Number(), {
      description: 'Campaign count by status',
    }),
  }),
  emails: Type.Object({
    totalSent: Type.Number({ description: 'Total emails sent' }),
    sentThisWeek: Type.Number({ description: 'Emails sent this week' }),
    sentThisMonth: Type.Number({ description: 'Emails sent this month' }),
    totalClicks: Type.Number({ description: 'Total email clicks' }),
    clickRate: Type.Number({ description: 'Click rate percentage (0-100)' }),
  }),
  contacts: Type.Object({
    total: Type.Number({ description: 'Total number of contacts' }),
    thisWeek: Type.Number({ description: 'New contacts added this week' }),
    thisMonth: Type.Number({ description: 'New contacts added this month' }),
  }),
  calendar: Type.Object({
    totalClicks: Type.Number({ description: 'Total calendar link clicks' }),
    clicksThisWeek: Type.Number({ description: 'Calendar clicks this week' }),
    clicksThisMonth: Type.Number({ description: 'Calendar clicks this month' }),
  }),
  recentActivity: Type.Array(
    Type.Object({
      id: Type.String({ description: 'Activity ID' }),
      type: Type.String({ description: 'Activity type' }),
      description: Type.String({ description: 'Activity description' }),
      timestamp: Type.String({ format: 'date-time', description: 'Activity timestamp' }),
      entityId: Type.Optional(Type.String({ description: 'Related entity ID' })),
      entityType: Type.Optional(Type.String({ description: 'Related entity type' })),
      contactName: Type.Optional(Type.String({ description: 'Contact name for calendar clicks' })),
      leadName: Type.Optional(Type.String({ description: 'Lead name for calendar clicks' })),
    }),
    { description: 'Recent activity items', maxItems: 10 }
  ),
});

export const DashboardResponseSchema = Type.Object({
  data: DashboardMetricsSchema,
});
