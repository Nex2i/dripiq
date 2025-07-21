import React from 'react'
import type { LeadStatus } from '../types/lead.types'
import { LEAD_STATUS, LEAD_STATUS_PRIORITY } from '../constants/leadStatus.constants'

interface LeadStatusBadgesProps {
  statuses: LeadStatus[]
  compact?: boolean
}

const getStatusColor = (status: LeadStatus['status']) => {
  switch (status) {
    case LEAD_STATUS.NEW:
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case LEAD_STATUS.SCRAPING_SITE:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case LEAD_STATUS.ANALYZING_SITE:
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case LEAD_STATUS.EXTRACTING_CONTACTS:
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case LEAD_STATUS.PROCESSED:
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getStatusIcon = (status: LeadStatus['status']) => {
  switch (status) {
    case LEAD_STATUS.NEW:
      return '✨'
    case LEAD_STATUS.SCRAPING_SITE:
      return '🔍'
    case LEAD_STATUS.ANALYZING_SITE:
      return '🧠'
    case LEAD_STATUS.EXTRACTING_CONTACTS:
      return '📞'
    case LEAD_STATUS.PROCESSED:
      return '✅'
    default:
      return '●'
  }
}

const LeadStatusBadges: React.FC<LeadStatusBadgesProps> = ({ statuses, compact = false }) => {
  if (!statuses || statuses.length === 0) {
    return (
      <span 
        className="text-gray-400 text-sm" 
        title="No status found - database migration may be needed"
      >
        No status
      </span>
    )
  }

  // Sort statuses by creation date to show progression
  const sortedStatuses = [...statuses].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  if (compact) {
    // For table view - show the most important status based on priority
    const mostImportantStatus = sortedStatuses.reduce((prev, current) => 
      LEAD_STATUS_PRIORITY[current.status] > LEAD_STATUS_PRIORITY[prev.status] ? current : prev
    )
    
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(mostImportantStatus.status)}`}
        title={`All statuses: ${sortedStatuses.map(s => s.status).join(', ')}`}
      >
        <span className="text-xs">{getStatusIcon(mostImportantStatus.status)}</span>
        {mostImportantStatus.status}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sortedStatuses.map((status) => (
        <span
          key={status.id}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status.status)}`}
        >
          <span className="text-xs">{getStatusIcon(status.status)}</span>
          {status.status}
        </span>
      ))}
    </div>
  )
}

export default LeadStatusBadges