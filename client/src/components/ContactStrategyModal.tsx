import React, { useState } from 'react'
import { X, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

interface ContactStrategyModalProps {
  isOpen: boolean
  onClose: () => void
  data: any
  contactName: string
  companyName: string
}

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="border border-gray-200 rounded-lg mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 text-left font-medium text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
      >
        {title}
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-gray-200">{children}</div>
      )}
    </div>
  )
}

const ContactStrategyModal: React.FC<ContactStrategyModalProps> = ({
  isOpen,
  onClose,
  data,
  contactName,
  companyName,
}) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null)

  if (!isOpen || !data) return null

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(itemId)
      setTimeout(() => setCopiedItem(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // Helper component for copyable text with individual copy button
  const CopyableText: React.FC<{
    text: string
    id: string
    label: string
    className?: string
    showBorder?: boolean
  }> = ({ text, id, label, className = "", showBorder = true }) => (
    <div className={`${showBorder ? 'border border-gray-200 rounded-lg p-3' : ''} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium text-gray-700">{label}:</h5>
        <button
          onClick={() => copyToClipboard(text, id)}
          className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded transition-colors"
          title={`Copy ${label.toLowerCase()}`}
        >
          {copiedItem === id ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  )

  const formatTouchpoint = (touchpoint: any, index: number) => {
    if (!touchpoint) return null

    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 text-lg">
            Touchpoint {index + 1} - {touchpoint.timing}
          </h4>
          <div className="flex items-center space-x-2">
            <span className="bg-[var(--color-primary-100)] text-[var(--color-primary-800)] text-xs font-medium px-2.5 py-0.5 rounded">
              {touchpoint.type}
            </span>
            <button
              onClick={() => copyToClipboard(formatTouchpointForCopy(touchpoint, index), `touchpoint-full-${index}`)}
              className="bg-[var(--color-primary-100)] hover:bg-[var(--color-primary-200)] text-[var(--color-primary-700)] px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1"
              title="Copy entire touchpoint"
            >
              {copiedItem === `touchpoint-full-${index}` ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy All</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {touchpoint.subject && (
            <CopyableText
              text={touchpoint.subject}
              id={`subject-${index}`}
              label="Subject"
            />
          )}
          
          <CopyableText
            text={touchpoint.content}
            id={`content-${index}`}
            label="Content"
          />
          
          <CopyableText
            text={touchpoint.callToAction}
            id={`cta-${index}`}
            label="Call to Action"
          />
        </div>
      </div>
    )
  }

  const formatTouchpointForCopy = (touchpoint: any, index: number) => {
    return `TOUCHPOINT ${index + 1} - ${touchpoint.timing} (${touchpoint.type})
---
${touchpoint.subject ? `Subject: ${touchpoint.subject}\n\n` : ''}Content:
${touchpoint.content}

Call to Action: ${touchpoint.callToAction}`.trim()
  }

  const formatFullCampaignForCopy = () => {
    if (!data.outreachCampaign) return ''

    let result = `CONTACT STRATEGY FOR ${contactName} at ${companyName}\n`
    result += `${'='.repeat(60)}\n\n`

    if (data.summary) {
      result += `SUMMARY:\n${data.summary}\n\n`
    }

    if (data.cadence) {
      result += `CAMPAIGN CADENCE:\n`
      result += `Interval: ${data.cadence.interval}\n`
      result += `Duration: ${data.cadence.totalDuration}\n\n`
    }

    result += `OUTREACH CAMPAIGN:\n\n`

    data.outreachCampaign.forEach((touchpoint: any, index: number) => {
      if (touchpoint) {
        result += formatTouchpointForCopy(touchpoint, index) + '\n\n'
      }
    })

    return result
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Contact Strategy & Outreach Plan
              </h2>
              <p className="text-[var(--color-primary-100)] mt-1">
                {contactName} at {companyName}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(formatFullCampaignForCopy(), 'full-strategy')}
                className="bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-400)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                {copiedItem === 'full-strategy' ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy All</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Summary */}
            {data.summary && (
              <CollapsibleSection title="Campaign Summary" defaultExpanded={true}>
                <div className="bg-[var(--color-primary-50)] border-l-4 border-[var(--color-primary-400)] p-4 rounded">
                  <div className="flex items-start justify-between">
                    <p className="text-gray-800 leading-relaxed flex-1 mr-4">{data.summary}</p>
                    <button
                      onClick={() => copyToClipboard(data.summary, 'summary')}
                      className="bg-white hover:bg-gray-50 text-gray-600 p-2 rounded transition-colors flex-shrink-0"
                      title="Copy summary"
                    >
                      {copiedItem === 'summary' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Campaign Cadence */}
            {data.cadence && (
              <CollapsibleSection title="Campaign Cadence">
                <div className="bg-[var(--color-success-50)] border border-[var(--color-success-200)] rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CopyableText
                      text={data.cadence.interval}
                      id="cadence-interval"
                      label="Interval"
                      showBorder={false}
                      className="bg-white p-3 rounded"
                    />
                    <CopyableText
                      text={data.cadence.totalDuration}
                      id="cadence-duration"
                      label="Total Duration"
                      showBorder={false}
                      className="bg-white p-3 rounded"
                    />
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Outreach Campaign */}
            {data.outreachCampaign && data.outreachCampaign.length > 0 && (
              <CollapsibleSection title="Outreach Campaign" defaultExpanded={true}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {data.outreachCampaign.length} Touchpoint{data.outreachCampaign.length !== 1 ? 's' : ''}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Click individual copy buttons to copy specific elements
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(formatFullCampaignForCopy(), 'campaign')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      {copiedItem === 'campaign' ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied Campaign!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy Entire Campaign</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {data.outreachCampaign.map((touchpoint: any, index: number) => {
                      return formatTouchpoint(touchpoint, index)
                    })}
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Empty state */}
            {(!data.outreachCampaign || data.outreachCampaign.length === 0) && !data.summary && (
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <p className="text-lg font-medium">No outreach strategy available</p>
                  <p className="text-sm mt-2">The contact strategy data appears to be empty or invalid.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactStrategyModal