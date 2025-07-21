import React from 'react'
import Tooltip from '@/components/Tooltip'
import { LEAD_STATUS_CONFIG, LEAD_STATUS_PRIORITY } from '@/constants/leadStatus.constants'
import type { LeadStatus } from '@/services/leads.service'

interface LeadStatusBadgesProps {
  statuses?: LeadStatus[]
  mode?: 'compact' | 'full'
  className?: string
}

// Map status colors to Tailwind CSS classes
const getStatusClasses = (color: string) => {
  switch (color) {
    case 'blue':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'orange':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'purple':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'green':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Create a badge component similar to existing patterns
const StatusBadge: React.FC<{ config: any; className?: string }> = ({ config, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusClasses(config.color)} ${className}`}>
    <span className="mr-1">{config.icon}</span>
    {config.label}
  </span>
)

const LeadStatusBadges: React.FC<LeadStatusBadgesProps> = ({ 
  statuses = [], 
  mode = 'full',
  className = ''
}) => {
  if (!statuses || statuses.length === 0) {
    return null
  }

  // Sort statuses by priority (highest priority first)
  const sortedStatuses = [...statuses].sort((a, b) => {
    const priorityA = LEAD_STATUS_PRIORITY[a.status as keyof typeof LEAD_STATUS_PRIORITY] || 0
    const priorityB = LEAD_STATUS_PRIORITY[b.status as keyof typeof LEAD_STATUS_PRIORITY] || 0
    return priorityB - priorityA
  })

  if (mode === 'compact') {
    // In compact mode, show only the highest priority status with a tooltip for all statuses
    const primaryStatus = sortedStatuses[0]
    const config = LEAD_STATUS_CONFIG[primaryStatus.status as keyof typeof LEAD_STATUS_CONFIG]
    
    if (!config) return null

    const badgeContent = <StatusBadge config={config} className={className} />

    if (statuses.length === 1) {
      return badgeContent
    }

    const tooltipContent = (
      <div className="space-y-1">
        <p className="font-medium text-white">All statuses:</p>
        {sortedStatuses.map((status) => {
          const statusConfig = LEAD_STATUS_CONFIG[status.status as keyof typeof LEAD_STATUS_CONFIG]
          return statusConfig ? (
            <div key={status.id} className="flex items-center gap-1 text-sm text-white">
              <span>{statusConfig.icon}</span>
              <span>{statusConfig.label}</span>
            </div>
          ) : null
        })}
      </div>
    )

    return (
      <Tooltip content={tooltipContent}>
        {badgeContent}
      </Tooltip>
    )
  }

  // Full mode: show all status badges
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {sortedStatuses.map((status) => {
        const config = LEAD_STATUS_CONFIG[status.status as keyof typeof LEAD_STATUS_CONFIG]
        
        if (!config) return null

        return <StatusBadge key={status.id} config={config} />
      })}
    </div>
  )
}

export default LeadStatusBadges