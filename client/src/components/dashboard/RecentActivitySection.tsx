// Recent Activity Section Component following Single Responsibility Principle
import React from 'react'
import { ActivityList } from './ActivityList'
import type { Activity } from './types'

interface RecentActivitySectionProps {
  activities: Activity[]
  onNavigateToLead: (leadId: string) => void
  onAddFirstLead: () => void
}

/**
 * RecentActivitySection Component
 * Single responsibility: Manage the recent activity section layout and data
 * Interface Segregation: Only receives the specific data it needs
 */
export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  activities,
  onNavigateToLead,
  onAddFirstLead,
}) => {
  return (
    <div>
      <h2
        className="text-xl font-semibold mb-4"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Recent Activity
      </h2>
      <div
        className="rounded-lg shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <div className="p-6">
          <ActivityList
            activities={activities}
            onNavigate={onNavigateToLead}
            onAddFirstLead={onAddFirstLead}
          />
        </div>
      </div>
    </div>
  )
}
