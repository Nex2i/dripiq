import { authService } from './auth.service'

// Dashboard types matching the backend schema
export interface DashboardMetrics {
  leads: {
    total: number
    thisWeek: number
    thisMonth: number
    byStatus: Record<string, number>
    assigned: number
    unassigned: number
  }
  campaigns: {
    total: number
    active: number
    byStatus: Record<string, number>
  }
  emails: {
    totalSent: number
    sentThisWeek: number
    sentThisMonth: number
    totalClicks: number
    clickRate: number
  }
  contacts: {
    total: number
    thisWeek: number
    thisMonth: number
  }
  calendar: {
    totalClicks: number
    clicksThisWeek: number
    clicksThisMonth: number
  }
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    entityId?: string
    entityType?: string
    contactName?: string
    leadName?: string
  }>
}

export interface DashboardResponse {
  data: DashboardMetrics
}

// Query keys for dashboard (centralized)
const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  metrics: () => [...dashboardQueryKeys.all, 'metrics'] as const,
}

class DashboardService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch dashboard metrics: ${response.statusText}`,
      )
    }

    const result: DashboardResponse = await response.json()
    return result.data
  }
}

// Export singleton instance
export const dashboardService = new DashboardService()

// Export query keys for use in hooks
export { dashboardQueryKeys }
