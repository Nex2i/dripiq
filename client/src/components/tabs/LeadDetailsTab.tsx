import React from 'react'
import { User, Globe } from 'lucide-react'
import LeadStatusBadges from '../LeadStatusBadges'
import { LeadStatus } from '../../services/leads.service'

interface LeadDetailsTabProps {
  status: string
  url: string
  statuses?: LeadStatus[]
}

const LeadDetailsTab: React.FC<LeadDetailsTabProps> = ({
  status,
  url,
  statuses,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Lead Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Processing Status</p>
                <div className="mt-1">
                  <LeadStatusBadges statuses={statuses || []} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Globe className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Website</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                >
                  {url}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadDetailsTab