// Statistics utility functions following Single Responsibility Principle
import type { DashboardStat } from '../types'
import type { DashboardMetrics } from '../../../services/dashboard.service'

/**
 * Generate dashboard statistics from raw metrics data
 * Single responsibility: Data transformation for statistics display
 */
export const generateDashboardStats = (
  dashboardData: DashboardMetrics | undefined
): DashboardStat[] => {
  if (!dashboardData) {
    return [
      { label: 'Total Leads', value: '-', change: 'Loading...' },
      { label: 'Active Campaigns', value: '-', change: 'Loading...' },
      { label: 'Emails Sent', value: '-', change: 'Loading...' },
      { label: 'Click Rate', value: '-', change: 'Loading...' },
    ]
  }

  return [
    {
      label: 'Total Leads',
      value: dashboardData.leads.total.toString(),
      change:
        dashboardData.leads.thisWeek > 0
          ? `+${dashboardData.leads.thisWeek} this week`
          : 'No new leads this week',
    },
    {
      label: 'Active Campaigns',
      value: dashboardData.campaigns.active.toString(),
      change: `${dashboardData.campaigns.total} total campaigns`,
    },
    {
      label: 'Emails Sent',
      value: dashboardData.emails.totalSent.toString(),
      change:
        dashboardData.emails.sentThisWeek > 0
          ? `+${dashboardData.emails.sentThisWeek} this week`
          : 'No emails sent this week',
    },
    {
      label: 'Click Rate',
      value: `${dashboardData.emails.clickRate.toFixed(1)}%`,
      change: `${dashboardData.emails.totalClicks} total clicks`,
    },
  ]
}