import React from 'react'
import { LeadStatus } from '../services/leads.service'

interface LeadStatusBadgesProps {
  statuses: LeadStatus[]
}

const getStatusColor = (status: LeadStatus['status']) => {
  switch (status) {
    case 'New':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Scraping Site':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Analyzing Site':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Extracting Contacts':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'Processed':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getStatusIcon = (status: LeadStatus['status']) => {
  switch (status) {
    case 'New':
      return '✨'
    case 'Scraping Site':
      return '🔍'
    case 'Analyzing Site':
      return '🧠'
    case 'Extracting Contacts':
      return '📞'
    case 'Processed':
      return '✅'
    default:
      return '●'
  }
}

const LeadStatusBadges: React.FC<LeadStatusBadgesProps> = ({ statuses }) => {
  if (!statuses || statuses.length === 0) {
    return null
  }

  // Sort statuses by creation date to show progression
  const sortedStatuses = [...statuses].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

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