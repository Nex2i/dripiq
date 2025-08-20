import React from 'react'
import type { LeadStatus } from '../types/lead.types'
import {
  LEAD_STATUS,
  LEAD_STATUS_PRIORITY,
} from '../constants/leadStatus.constants'

interface LeadStatusBadgesProps {
  statuses: LeadStatus[]
  compact?: boolean
}

const getStatusColor = (status: LeadStatus['status']) => {
  switch (status) {
    case LEAD_STATUS.UNPROCESSED:
      return 'bg-gray-100 text-gray-800 border-gray-200'
    case LEAD_STATUS.SYNCING_SITE:
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
    case LEAD_STATUS.UNPROCESSED:
      return '⏳'
    case LEAD_STATUS.SYNCING_SITE:
      return '🔄'
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

const LeadStatusBadges: React.FC<LeadStatusBadgesProps> = ({
  statuses,
  compact = false,
}) => {
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
  const sortedStatuses = [...statuses].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  if (compact) {
    // For table view - show the most important status based on priority
    const mostImportantStatus = sortedStatuses.reduce((prev, current) =>
      LEAD_STATUS_PRIORITY[current.status] > LEAD_STATUS_PRIORITY[prev.status]
        ? current
        : prev,
    )

    const hasMultipleStatuses = sortedStatuses.length > 1

    return (
      <div className="relative group">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(mostImportantStatus.status)} ${hasMultipleStatuses ? 'cursor-help' : ''}`}
        >
          <span className="text-xs">
            {getStatusIcon(mostImportantStatus.status)}
          </span>
          {mostImportantStatus.status}
          {hasMultipleStatuses && (
            <span className="ml-1 px-1 py-0.5 bg-transparent rounded-full text-xs font-bold leading-none opacity-70">
              +{sortedStatuses.length - 1}
            </span>
          )}
        </span>

        {hasMultipleStatuses && (
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 w-max max-w-xs">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
              <div className="font-semibold mb-1">All Statuses:</div>
              <div className="space-y-1">
                {sortedStatuses.map((status, index) => (
                  <div key={status.id} className="flex items-center gap-2">
                    <span>{getStatusIcon(status.status)}</span>
                    <span>{status.status}</span>
                    {index === 0 && (
                      <span className="text-gray-400 text-xs">(primary)</span>
                    )}
                  </div>
                ))}
              </div>
              {/* Tooltip arrow */}
              <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
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
