// Activity utility functions following Single Responsibility Principle
import type { ActivityStyle } from '../types'

/**
 * Format activity timestamp to human-readable relative time
 * Single responsibility: Time formatting logic
 */
export const formatActivityTime = (timestamp: string): string => {
  const now = new Date()
  const activityTime = new Date(timestamp)
  const diffMs = now.getTime() - activityTime.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }
}

/**
 * Get activity styling based on activity type
 * Single responsibility: Activity styling logic
 */
export const getActivityStyle = (type: string): ActivityStyle => {
  switch (type) {
    case 'lead_created':
      return { color: 'var(--color-primary-500)', icon: '👥' }
    case 'campaign_started':
    case 'campaign_created':
      return { color: 'var(--color-success-500)', icon: '📊' }
    case 'email_sent':
      return { color: 'var(--color-surface-500)', icon: '📧' }
    case 'calendar_clicked':
      return { color: 'var(--color-accent-500)', icon: '📅' }
    default:
      return { color: 'var(--color-text-muted)', icon: '•' }
  }
}

/**
 * Determine if an activity should be navigable
 * Single responsibility: Navigation logic determination
 */
export const isActivityNavigable = (activity: {
  type: string
  entityId?: string
  entityType?: string
}): boolean => {
  return (
    activity.type === 'calendar_clicked' &&
    Boolean(activity.entityId) &&
    activity.entityType === 'lead'
  )
}