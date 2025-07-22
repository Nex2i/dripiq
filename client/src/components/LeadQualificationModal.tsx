import React, { useState } from 'react'
import { X, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

interface LeadQualificationModalProps {
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
  defaultExpanded = false 
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
        <div className="p-4 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  )
}

const LeadQualificationModal: React.FC<LeadQualificationModalProps> = ({
  isOpen,
  onClose,
  data,
  contactName,
  companyName,
}) => {
  const [showRawJson, setShowRawJson] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const renderTouchpoint = (touchpoint: any, index: number) => {
    return (
      <div key={index} className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900">
            Touchpoint {index + 1} - {touchpoint.type?.toUpperCase()}
          </h4>
          <span className="text-sm text-gray-500">{touchpoint.timing}</span>
        </div>
        <div className="space-y-2">
          <div>
            <span className="font-medium text-gray-700">Subject: </span>
            <span className="text-gray-900">{touchpoint.subject}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Content: </span>
            <p className="text-gray-900 whitespace-pre-wrap">{touchpoint.content}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Call to Action: </span>
            <span className="text-gray-900">{touchpoint.callToAction}</span>
          </div>
          {touchpoint.notes && (
            <div>
              <span className="font-medium text-gray-700">Notes: </span>
              <span className="text-gray-600">{touchpoint.notes}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Lead Qualification & Outreach Strategy
            </h2>
            <p className="text-gray-600 mt-1">
              {contactName} at {companyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6">
            {/* Toggle View */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowRawJson(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    !showRawJson
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Structured View
                </button>
                <button
                  onClick={() => setShowRawJson(true)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    showRawJson
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Raw JSON
                </button>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>

            {showRawJson ? (
              /* Raw JSON View */
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            ) : (
              /* Structured View */
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Executive Summary</h3>
                  <p className="text-blue-800">{data.summary}</p>
                </div>

                {/* Lead Research */}
                <CollapsibleSection title="Lead Research & Analysis" defaultExpanded>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Company Background</h4>
                      <p className="text-gray-700">{data.leadResearch?.companyBackground}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Industry Context</h4>
                      <p className="text-gray-700">{data.leadResearch?.industryContext}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Problem-Solution Fit</h4>
                      <p className="text-gray-700">{data.leadResearch?.problemSolutionFit}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Priority Score</h4>
                        <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${
                          data.leadResearch?.priorityScore === 'high' 
                            ? 'bg-red-100 text-red-800'
                            : data.leadResearch?.priorityScore === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {data.leadResearch?.priorityScore?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Potential Value</h4>
                        <p className="text-gray-700">{data.leadResearch?.potentialValue}</p>
                      </div>
                    </div>

                    {data.leadResearch?.recentNews?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Recent News</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {data.leadResearch.recentNews.map((news: string, index: number) => (
                            <li key={index} className="text-gray-700">{news}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Contact Analysis */}
                <CollapsibleSection title="Contact Analysis">
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Contact Profile</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium text-gray-700">Name: </span>
                          <span className="text-gray-900">{data.contactAnalysis?.contact?.name}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Title: </span>
                          <span className="text-gray-900">{data.contactAnalysis?.contact?.title || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Persona: </span>
                          <span className="text-gray-900">{data.contactAnalysis?.contact?.persona}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Messaging Approach: </span>
                          <span className="text-gray-900">{data.contactAnalysis?.contact?.messagingApproach}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Decision Making Role</h4>
                      <p className="text-gray-700">{data.contactAnalysis?.decisionMakingRole}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Engagement Strategy</h4>
                      <p className="text-gray-700">{data.contactAnalysis?.engagementStrategy}</p>
                    </div>

                    {data.contactAnalysis?.contact?.painPoints?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Pain Points</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {data.contactAnalysis.contact.painPoints.map((point: string, index: number) => (
                            <li key={index} className="text-gray-700">{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {data.contactAnalysis?.contact?.professionalGoals?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Professional Goals</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {data.contactAnalysis.contact.professionalGoals.map((goal: string, index: number) => (
                            <li key={index} className="text-gray-700">{goal}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Outreach Strategy */}
                <CollapsibleSection title="Outreach Strategy">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Frequency</h4>
                        <p className="text-gray-700">{data.outreachStrategy?.timing?.frequency}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Total Duration</h4>
                        <p className="text-gray-700">{data.outreachStrategy?.timing?.totalDuration}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Channel Mix</h4>
                      <div className="flex flex-wrap gap-2">
                        {data.outreachStrategy?.channelMix?.map((channel: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                            {channel}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-4">Drip Campaign</h4>
                      {data.outreachStrategy?.dripCampaign && Object.entries(data.outreachStrategy.dripCampaign).map(([key, touchpoint], index) => 
                        renderTouchpoint(touchpoint, index)
                      )}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Messaging Framework */}
                <CollapsibleSection title="Messaging Framework">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Value Proposition</h4>
                      <p className="text-gray-700">{data.messaging?.valueProposition}</p>
                    </div>

                    {data.messaging?.keyBenefits?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Key Benefits</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {data.messaging.keyBenefits.map((benefit: string, index: number) => (
                            <li key={index} className="text-gray-700">{benefit}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {data.messaging?.objectionHandling?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Objection Handling</h4>
                        <div className="space-y-3">
                          {data.messaging.objectionHandling.map((item: any, index: number) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-3">
                              <div className="font-medium text-gray-900 mb-1">
                                Objection: {item.objection}
                              </div>
                              <div className="text-gray-700">
                                Response: {item.response}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Next Steps */}
                <CollapsibleSection title="Next Steps">
                  <div className="space-y-4">
                    {data.nextSteps?.immediateActions?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Immediate Actions</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {data.nextSteps.immediateActions.map((action: string, index: number) => (
                            <li key={index} className="text-gray-700">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Follow-up Schedule</h4>
                      <p className="text-gray-700">{data.nextSteps?.followUpSchedule}</p>
                    </div>

                    {data.nextSteps?.successMetrics?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Success Metrics</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {data.nextSteps.successMetrics.map((metric: string, index: number) => (
                            <li key={index} className="text-gray-700">{metric}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadQualificationModal