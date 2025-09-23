// Dashboard component types following Single Responsibility Principle

export interface Activity {
  id: string
  type: string
  description: string
  timestamp: string
  entityId?: string
  entityType?: string
  contactName?: string
  leadName?: string
}

export interface ActivityStyle {
  color: string
  icon: string
}

export interface QuickAction {
  title: string
  description: string
  icon: string
  action: () => void
}

export interface DashboardStat {
  label: string
  value: string
  change: string
}
