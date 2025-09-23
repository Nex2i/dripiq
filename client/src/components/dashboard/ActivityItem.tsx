// Single Activity Item Component following Single Responsibility Principle
import React from 'react'
import type { Activity } from './types'
import { formatActivityTime, getActivityStyle, isActivityNavigable } from './utils/activityUtils'

interface ActivityItemProps {
  activity: Activity
  onNavigate: (entityId: string) => void
}

/**
 * ActivityItem Component
 * Single responsibility: Render a single activity item with navigation capability
 * Open/Closed: Can be extended for new activity types without modification
 */
export const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  onNavigate,
}) => {
  const style = getActivityStyle(activity.type)
  const navigable = isActivityNavigable(activity)

  const handleClick = () => {
    if (navigable && activity.entityId) {
      onNavigate(activity.entityId)
    }
  }

  return (
    <div
      className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
        navigable
          ? 'cursor-pointer hover:bg-gray-50'
          : ''
      }`}
      onClick={handleClick}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: style.color }}
      />
      <p
        className="text-sm flex-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span
          className={`font-medium ${navigable ? 'hover:underline' : ''}`}
          style={{ color: 'var(--color-text-primary)' }}
        >
          {activity.description}
        </span>
      </p>
      <span
        className="text-xs flex-shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {formatActivityTime(activity.timestamp)}
      </span>
    </div>
  )
}