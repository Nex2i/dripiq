import React from 'react'
import { Globe, Users, RefreshCw, Edit } from 'lucide-react'
import Tooltip from './Tooltip'
import LeadStatusBadges from './LeadStatusBadges'
import type { Lead } from '../types/lead.types'

interface LeadViewHeaderProps {
  lead: Lead
  formatDate: (dateString: string) => string
  onResync: () => void
  onVendorFit: () => void
  onStartEdit: () => void
  isResyncing: boolean
  isVendorFitting: boolean
}

const LeadViewHeader: React.FC<LeadViewHeaderProps> = ({
  lead,
  formatDate,
  onResync,
  onVendorFit,
  onStartEdit,
  isResyncing,
  isVendorFitting,
}) => {
  return (
    <div className="flex justify-between items-start">
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-3">
            <Tooltip
              content={
                <div className="text-left">
                  <div>Created: {formatDate(lead.createdAt)}</div>
                  <div>Updated: {formatDate(lead.updatedAt)}</div>
                </div>
              }
            >
              <h1 className="text-3xl font-bold text-gray-900 cursor-help">
                {lead.name}
              </h1>
            </Tooltip>
            {lead.url && (
              <a
                href={lead.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
              >
                <Globe className="h-5 w-5 mr-1" />
                <span className="text-lg">
                  {lead.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
              </a>
            )}
          </div>
          <div className="mt-3">
            <LeadStatusBadges statuses={lead.statuses || []} />
          </div>
          <p className="mt-2 text-gray-600">Lead Details</p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={onResync}
          disabled={isResyncing}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isResyncing ? 'animate-spin' : ''}`}
          />
          {isResyncing ? 'Resyncing...' : 'Resync'}
        </button>
        <button
          onClick={onVendorFit}
          disabled={isVendorFitting}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Users
            className={`h-4 w-4 mr-2 ${isVendorFitting ? 'animate-spin' : ''}`}
          />
          {isVendorFitting ? 'Running...' : 'Vendor Fit'}
        </button>
        <button
          onClick={onStartEdit}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </button>
      </div>
    </div>
  )
}

export default LeadViewHeader
