// Activity List Component following Single Responsibility Principle
import React from 'react'
import { ActivityItem } from './ActivityItem'
import type { Activity } from './types'

interface ActivityListProps {
  activities: Activity[]
  onNavigate: (entityId: string) => void
  onAddFirstLead: () => void
}

/**
 * ActivityList Component
 * Single responsibility: Manage and display a list of activities
 * Dependency Inversion: Depends on navigation abstraction via props
 */
export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onNavigate,
  onAddFirstLead,
}) => {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p style={{ color: 'var(--color-text-muted)' }}>
          No recent activity to display. Start by adding some leads!
        </p>
        <button
          onClick={onAddFirstLead}
          className="mt-4 px-4 py-2 rounded-md text-white font-medium"
          style={{ backgroundColor: 'var(--color-primary-600)' }}
        >
          Add Your First Lead
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}