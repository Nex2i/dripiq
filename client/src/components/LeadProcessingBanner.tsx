import React, { useEffect } from 'react'
import { Clock, CheckCircle, Loader, Info } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { LeadStatus } from '../types/lead.types'
import {
  getStatusMessage,
  getProcessingProgress,
} from '../utils/leadStatusMessages'
import { leadQueryKeys } from '../hooks/useLeadsQuery'

interface LeadProcessingBannerProps {
  leadId: string
  statuses: LeadStatus[]
  className?: string
}

const LeadProcessingBanner: React.FC<LeadProcessingBannerProps> = ({
  leadId,
  statuses,
  className = '',
}) => {
  const queryClient = useQueryClient()
  const statusMessage = getStatusMessage(statuses)
  const progress = getProcessingProgress(statuses)

  // Poll for status updates every 10 seconds when processing
  useEffect(() => {
    if (!statusMessage?.isProcessing) {
      return
    }

    // Set up polling interval
    const interval = setInterval(() => {
      // Invalidate and refetch the lead data to get updated statuses
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadId),
      })
    }, 30 * 1000) // 30 seconds

    return () => clearInterval(interval)
  }, [leadId, statusMessage?.isProcessing, queryClient])

  // Also poll more frequently for the first minute to catch quick status changes
  useEffect(() => {
    if (!statusMessage?.isProcessing) {
      return
    }

    // Quick polling for the first minute
    const quickInterval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadId),
      })
    }, 5 * 1000) // 5 seconds

    // Stop quick polling after 1 minute
    const timeout = setTimeout(
      () => {
        clearInterval(quickInterval)
      },
      1 * 60 * 1000,
    ) // 1 minute

    return () => {
      clearInterval(quickInterval)
      clearTimeout(timeout)
    }
  }, [leadId, statusMessage?.isProcessing, queryClient])

  if (!statusMessage) {
    return null
  }

  const { title, description, estimatedTime, isProcessing } = statusMessage

  return (
    <div
      className={`rounded-lg border p-4 ${
        isProcessing
          ? 'bg-[var(--color-surface-50)] border-[var(--color-surface-200)]'
          : 'bg-[var(--color-success-50)] border-[var(--color-success-200)]'
      } ${className}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {isProcessing ? (
            <div className="relative">
              <Loader className="h-5 w-5 text-[var(--color-surface-600)] animate-spin" />
              <div className="absolute inset-0 rounded-full border-2 border-[var(--color-surface-300)] border-t-[var(--color-surface-600)] animate-spin"></div>
            </div>
          ) : (
            <CheckCircle className="h-5 w-5 text-[var(--color-success-600)] animate-bounce" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3
              className={`text-sm font-medium ${
                isProcessing
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-success-900)]'
              }`}
            >
              {title}
            </h3>
            {isProcessing && estimatedTime && (
              <div className="flex items-center text-xs text-[var(--color-text-secondary)]">
                <Clock className="h-3 w-3 mr-1" />
                <span>{estimatedTime}</span>
              </div>
            )}
          </div>

          <p
            className={`mt-1 text-sm ${
              isProcessing
                ? 'text-[var(--color-text-secondary)]'
                : 'text-[var(--color-success-700)]'
            }`}
          >
            {description}
          </p>

          {isProcessing && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                <span>Processing Progress</span>
                <span className="font-medium">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-[var(--color-surface-200)] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[var(--color-surface-500)] to-[var(--color-surface-600)] h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                <span>
                  Step {progress.current} of {progress.total}
                </span>
                <span className="flex items-center">
                  {progress.current === progress.total ? (
                    '✅ Complete'
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-[var(--color-surface-500)] rounded-full animate-pulse mr-1"></div>
                      Processing...
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-[var(--color-text-muted)]">
                💡 <strong>Tip:</strong> Check back in a few minutes to see the
                AI analysis results and extracted contacts.
              </div>

              {/* Step Details */}
              <div className="mt-4">
                <button
                  type="button"
                  className="flex items-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium"
                  onClick={() => {
                    const details = document.getElementById(
                      `step-details-${leadId}`,
                    )
                    if (details) {
                      details.style.display =
                        details.style.display === 'none' ? 'block' : 'none'
                    }
                  }}
                >
                  <Info className="h-3 w-3 mr-1" />
                  What's happening in each step?
                </button>
                <div
                  id={`step-details-${leadId}`}
                  className="mt-2 text-xs text-[var(--color-text-secondary)] space-y-2"
                  style={{ display: 'none' }}
                >
                  <div className="bg-[var(--color-surface-100)] border-l-2 border-[var(--color-surface-200)] pl-3 py-2 space-y-1">
                    <div>
                      <strong>🔄 Initial Processing:</strong> Getting the
                      website's sitemap and filtering relevant pages
                    </div>
                    <div>
                      <strong>🌐 Syncing Site:</strong> Collecting and
                      organizing website content for analysis
                    </div>
                    <div>
                      <strong>🔍 Scraping Site:</strong> Gathering detailed
                      information from website pages
                    </div>
                    <div>
                      <strong>🧠 Analyzing Site:</strong> AI is creating a
                      comprehensive business summary
                    </div>
                    <div>
                      <strong>📞 Extracting Contacts:</strong> Finding and
                      organizing contact information
                    </div>
                    <div>
                      <strong>✅ Processed:</strong> Analysis complete! Ready
                      for outreach campaigns
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadProcessingBanner
