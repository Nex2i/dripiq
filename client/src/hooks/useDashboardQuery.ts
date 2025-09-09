import { useQuery } from '@tanstack/react-query'
import type { DashboardMetrics } from '../services/dashboard.service'
import {
  dashboardService,
  dashboardQueryKeys,
} from '../services/dashboard.service'

/**
 * Hook to fetch dashboard metrics
 */
export function useDashboardMetrics() {
  return useQuery<DashboardMetrics, Error>({
    queryKey: dashboardQueryKeys.metrics(),
    queryFn: () => dashboardService.getDashboardMetrics(),
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Re-export types and query keys for convenience
export type { DashboardMetrics }
export { dashboardQueryKeys }
