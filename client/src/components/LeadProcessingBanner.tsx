import React from 'react'
import { Clock, CheckCircle, Loader } from 'lucide-react'
import type { LeadStatus } from '../types/lead.types'
import { getStatusMessage, getProcessingProgress } from '../utils/leadStatusMessages'

interface LeadProcessingBannerProps {
  statuses: LeadStatus[]
  className?: string
}

const LeadProcessingBanner: React.FC<LeadProcessingBannerProps> = ({
  statuses,
  className = '',
}) => {
  const statusMessage = getStatusMessage(statuses)
  const progress = getProcessingProgress(statuses)

  if (!statusMessage) {
    return null
  }

  const { title, description, estimatedTime, isProcessing } = statusMessage

  return (
    <div
      className={`rounded-lg border p-4 ${
        isProcessing
          ? 'bg-blue-50 border-blue-200'
          : 'bg-green-50 border-green-200'
      } ${className}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {isProcessing ? (
            <Loader className="h-5 w-5 text-blue-600 animate-spin" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3
              className={`text-sm font-medium ${
                isProcessing ? 'text-blue-900' : 'text-green-900'
              }`}
            >
              {title}
            </h3>
            {isProcessing && estimatedTime && (
              <div className="flex items-center text-xs text-blue-600">
                <Clock className="h-3 w-3 mr-1" />
                <span>{estimatedTime}</span>
              </div>
            )}
          </div>

          <p
            className={`mt-1 text-sm ${
              isProcessing ? 'text-blue-700' : 'text-green-700'
            }`}
          >
            {description}
          </p>

          {isProcessing && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                <span>Progress</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-blue-500 mt-1">
                <span>Step {progress.current} of {progress.total}</span>
                <span>
                  {progress.current === progress.total ? 'Complete' : 'In Progress'}
                </span>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="mt-3 text-xs text-blue-600">
              💡 <strong>Tip:</strong> Check back in a few minutes to see the AI analysis results and extracted contacts.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadProcessingBanner