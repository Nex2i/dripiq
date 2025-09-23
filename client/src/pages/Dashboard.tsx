import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardMetrics } from '../hooks/useDashboardQuery'
import {
  DashboardLayout,
  WelcomeSection,
  DashboardLoadingState,
  DashboardErrorState,
  StatsGrid,
  QuickActionsSection,
  RecentActivitySection,
  generateDashboardStats,
  generateQuickActions,
} from '../components/dashboard'

/**
 * Dashboard Component - Main dashboard container
 * Single responsibility: Coordinate dashboard data and navigation
 * Dependency Inversion: Depends on abstractions (hooks, components) not implementations
 */
function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: dashboardData, isLoading, error } = useDashboardMetrics()

  // Navigation handlers following Dependency Inversion Principle
  const navigationHandlers = {
    navigateToLeads: () => navigate({ to: '/leads' }),
    navigateToNewLead: () => navigate({ to: '/leads/new' }),
    navigateToSettings: () => navigate({ to: '/settings' }),
    navigateToUsers: () => navigate({ to: '/settings/users' }),
    navigateToLead: (leadId: string) => navigate({ to: `/leads/${leadId}` }),
  }

  // Generate data using utility functions (Single Responsibility)
  const stats = generateDashboardStats(dashboardData)
  const quickActions = generateQuickActions(
    navigationHandlers.navigateToLeads,
    navigationHandlers.navigateToNewLead,
    navigationHandlers.navigateToSettings,
    navigationHandlers.navigateToUsers,
  )

  // Handle loading state
  if (isLoading) {
    return <DashboardLoadingState />
  }

  // Handle error state
  if (error) {
    return (
      <DashboardErrorState
        error={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <DashboardLayout>
      <WelcomeSection
        userName={user?.user?.name || undefined}
        userEmail={user?.user?.email || undefined}
      />

      <StatsGrid stats={stats} />

      <QuickActionsSection actions={quickActions} />

      <RecentActivitySection
        activities={dashboardData?.recentActivity || []}
        onNavigateToLead={navigationHandlers.navigateToLead}
        onAddFirstLead={navigationHandlers.navigateToNewLead}
      />
    </DashboardLayout>
  )
}

export default Dashboard
