// Dashboard components barrel export following Interface Segregation Principle
// Clients only import what they need

// Core Layout Components
export { DashboardLayout } from './DashboardLayout'
export { WelcomeSection } from './WelcomeSection'

// State Components
export { DashboardLoadingState } from './DashboardLoadingState'
export { DashboardErrorState } from './DashboardErrorState'

// Statistics Components
export { StatCard } from './StatCard'
export { StatsGrid } from './StatsGrid'

// Quick Actions Components
export { QuickActionCard } from './QuickActionCard'
export { QuickActionsSection } from './QuickActionsSection'

// Activity Components
export { ActivityItem } from './ActivityItem'
export { ActivityList } from './ActivityList'
export { RecentActivitySection } from './RecentActivitySection'

// Utility Functions
export {
  formatActivityTime,
  getActivityStyle,
  isActivityNavigable,
} from './utils/activityUtils'
export { generateDashboardStats } from './utils/statsUtils'
export { generateQuickActions } from './utils/quickActionsUtils'

// Types
export type {
  Activity,
  ActivityStyle,
  QuickAction,
  DashboardStat,
} from './types'
