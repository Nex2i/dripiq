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
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  if (!isOpen || !data) return null

  const copyToClipboard = async (text: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSection(sectionName)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const formatTouchpoint = (touchpoint: any, index: number) => {
    if (!touchpoint) return null

    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">
            Touchpoint {index + 1} - {touchpoint.timing}
          </h4>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            {touchpoint.type}
          </span>
        </div>
        
        <div className="space-y-3">
          <div>
            <h5 className="font-medium text-gray-700 mb-1">Subject/Purpose:</h5>
            <p className="text-gray-600">{touchpoint.subject}</p>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-700 mb-1">Content:</h5>
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-gray-800 whitespace-pre-wrap">{touchpoint.content}</p>
            </div>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-700 mb-1">Call to Action:</h5>
            <p className="text-gray-600 font-medium">{touchpoint.callToAction}</p>
          </div>
          
          {touchpoint.notes && (
            <div>
              <h5 className="font-medium text-gray-700 mb-1">Notes:</h5>
              <p className="text-gray-500 text-sm">{touchpoint.notes}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const formatTouchpointForCopy = (touchpoint: any, index: number) => {
    return `
TOUCHPOINT ${index + 1} - ${touchpoint.timing} (${touchpoint.type})
---
Subject: ${touchpoint.subject}

Content:
${touchpoint.content}

Call to Action: ${touchpoint.callToAction}
${touchpoint.notes ? `\nNotes: ${touchpoint.notes}` : ''}
    `.trim()
  }

  const formatFullCampaignForCopy = () => {
    if (!data.outreachStrategy?.dripCampaign) return ''

    const campaign = data.outreachStrategy.dripCampaign
    const touchpoints = [
      campaign.touchpoint1,
      campaign.touchpoint2,
      campaign.touchpoint3,
      campaign.touchpoint4,
      campaign.touchpoint5,
      campaign.touchpoint6,
    ]

    let result = `CONTACT STRATEGY FOR ${contactName} at ${companyName}\n`
    result += `${'='.repeat(60)}\n\n`

    if (data.summary) {
      result += `EXECUTIVE SUMMARY:\n${data.summary}\n\n`
    }

    result += `OUTREACH CAMPAIGN:\n`
    result += `Frequency: ${data.outreachStrategy.timing?.frequency || 'Not specified'}\n`
    result += `Duration: ${data.outreachStrategy.timing?.totalDuration || 'Not specified'}\n\n`

    touchpoints.forEach((touchpoint, index) => {
      if (touchpoint) {
        result += formatTouchpointForCopy(touchpoint, index) + '\n\n'
      }
    })

    if (data.messaging?.valueProposition) {
      result += `VALUE PROPOSITION:\n${data.messaging.valueProposition}\n\n`
    }

    if (data.messaging?.keyBenefits?.length > 0) {
      result += `KEY BENEFITS:\n`
      data.messaging.keyBenefits.forEach((benefit: string) => {
        result += `• ${benefit}\n`
      })
      result += '\n'
    }

    if (data.nextSteps?.immediateActions?.length > 0) {
      result += `IMMEDIATE ACTIONS:\n`
      data.nextSteps.immediateActions.forEach((action: string) => {
        result += `• ${action}\n`
      })
    }

    return result
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Contact Strategy & Outreach Plan
              </h2>
              <p className="text-blue-100 mt-1">
                {contactName} at {companyName}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(formatFullCampaignForCopy(), 'full-strategy')}
                className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                {copiedSection === 'full-strategy' ? (
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
            {/* Executive Summary */}
            {data.summary && (
              <CollapsibleSection title="Executive Summary" defaultExpanded={true}>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <p className="text-gray-800 leading-relaxed">{data.summary}</p>
                </div>
              </CollapsibleSection>
            )}

            {/* Company Research */}
            {data.leadResearch && (
              <CollapsibleSection title="Company Research & Analysis">
                <div className="space-y-4">
                  {data.leadResearch.companyBackground && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Company Background</h4>
                      <p className="text-gray-700 leading-relaxed">{data.leadResearch.companyBackground}</p>
                    </div>
                  )}
                  
                  {data.leadResearch.recentNews && data.leadResearch.recentNews.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Recent News & Updates</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.leadResearch.recentNews.map((news: string, index: number) => (
                          <li key={index} className="text-gray-700">{news}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {data.leadResearch.industryContext && (
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-medium text-gray-900">Industry Context</h5>
                        <p className="text-gray-700 text-sm mt-1">{data.leadResearch.industryContext}</p>
                      </div>
                    )}
                    
                    {data.leadResearch.priorityScore && (
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-medium text-gray-900">Priority Score</h5>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                          data.leadResearch.priorityScore === 'high' ? 'bg-red-100 text-red-800' :
                          data.leadResearch.priorityScore === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {data.leadResearch.priorityScore.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {data.leadResearch.problemSolutionFit && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Problem-Solution Fit</h4>
                      <p className="text-gray-700 leading-relaxed">{data.leadResearch.problemSolutionFit}</p>
                    </div>
                  )}
                  
                  {data.leadResearch.potentialValue && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Potential Value</h4>
                      <p className="text-gray-700">{data.leadResearch.potentialValue}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Contact Analysis */}
            {data.contactAnalysis && (
              <CollapsibleSection title="Contact Analysis">
                <div className="space-y-4">
                  {data.contactAnalysis.contact && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Contact Profile</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700">Name</h5>
                          <p className="text-gray-900">{data.contactAnalysis.contact.name}</p>
                        </div>
                        {data.contactAnalysis.contact.title && (
                          <div>
                            <h5 className="font-medium text-gray-700">Title</h5>
                            <p className="text-gray-900">{data.contactAnalysis.contact.title}</p>
                          </div>
                        )}
                        {data.contactAnalysis.contact.persona && (
                          <div>
                            <h5 className="font-medium text-gray-700">Persona</h5>
                            <p className="text-gray-900">{data.contactAnalysis.contact.persona}</p>
                          </div>
                        )}
                        {data.contactAnalysis.contact.messagingApproach && (
                          <div>
                            <h5 className="font-medium text-gray-700">Messaging Approach</h5>
                            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                              {data.contactAnalysis.contact.messagingApproach}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {data.contactAnalysis.contact.painPoints && data.contactAnalysis.contact.painPoints.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-700 mb-2">Pain Points</h5>
                          <ul className="list-disc list-inside space-y-1">
                            {data.contactAnalysis.contact.painPoints.map((pain: string, index: number) => (
                              <li key={index} className="text-gray-700 text-sm">{pain}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {data.contactAnalysis.contact.professionalGoals && data.contactAnalysis.contact.professionalGoals.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-700 mb-2">Professional Goals</h5>
                          <ul className="list-disc list-inside space-y-1">
                            {data.contactAnalysis.contact.professionalGoals.map((goal: string, index: number) => (
                              <li key={index} className="text-gray-700 text-sm">{goal}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.contactAnalysis.decisionMakingRole && (
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-medium text-gray-900">Decision-Making Role</h5>
                        <p className="text-gray-700 text-sm mt-1">{data.contactAnalysis.decisionMakingRole}</p>
                      </div>
                    )}
                    
                    {data.contactAnalysis.influenceLevel && (
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-medium text-gray-900">Influence Level</h5>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                          data.contactAnalysis.influenceLevel === 'high' ? 'bg-red-100 text-red-800' :
                          data.contactAnalysis.influenceLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {data.contactAnalysis.influenceLevel.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {data.contactAnalysis.engagementStrategy && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Engagement Strategy</h4>
                      <p className="text-gray-700 leading-relaxed">{data.contactAnalysis.engagementStrategy}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Outreach Strategy */}
            {data.outreachStrategy && (
              <CollapsibleSection title="Outreach Campaign" defaultExpanded={true}>
                <div className="space-y-6">
                  {/* Campaign Overview */}
                  {data.outreachStrategy.timing && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Campaign Timeline</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700">Frequency</h5>
                          <p className="text-gray-900">{data.outreachStrategy.timing.frequency}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-700">Total Duration</h5>
                          <p className="text-gray-900">{data.outreachStrategy.timing.totalDuration}</p>
                        </div>
                      </div>
                      
                      {data.outreachStrategy.channelMix && data.outreachStrategy.channelMix.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-700 mb-2">Channel Mix</h5>
                          <div className="flex flex-wrap gap-2">
                            {data.outreachStrategy.channelMix.map((channel: string, index: number) => (
                              <span key={index} className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded">
                                {channel}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Touchpoints */}
                  {data.outreachStrategy.dripCampaign && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Drip Campaign Touchpoints</h4>
                        <button
                          onClick={() => copyToClipboard(formatFullCampaignForCopy(), 'campaign')}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1"
                        >
                          {copiedSection === 'campaign' ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy Campaign</span>
                            </>
                          )}
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {[
                          data.outreachStrategy.dripCampaign.touchpoint1,
                          data.outreachStrategy.dripCampaign.touchpoint2,
                          data.outreachStrategy.dripCampaign.touchpoint3,
                          data.outreachStrategy.dripCampaign.touchpoint4,
                          data.outreachStrategy.dripCampaign.touchpoint5,
                          data.outreachStrategy.dripCampaign.touchpoint6,
                        ].map((touchpoint, index) => {
                          if (!touchpoint) return null
                          return (
                            <div key={index} className="relative">
                              {formatTouchpoint(touchpoint, index)}
                              <button
                                onClick={() => copyToClipboard(formatTouchpointForCopy(touchpoint, index), `touchpoint-${index}`)}
                                className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded transition-colors"
                                title={`Copy Touchpoint ${index + 1}`}
                              >
                                {copiedSection === `touchpoint-${index}` ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Messaging Framework */}
            {data.messaging && (
              <CollapsibleSection title="Messaging Framework">
                <div className="space-y-4">
                  {data.messaging.valueProposition && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Value Proposition</h4>
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                        <p className="text-gray-800 leading-relaxed">{data.messaging.valueProposition}</p>
                      </div>
                    </div>
                  )}
                  
                  {data.messaging.keyBenefits && data.messaging.keyBenefits.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Key Benefits</h4>
                      <ul className="list-disc list-inside space-y-1 bg-gray-50 p-4 rounded">
                        {data.messaging.keyBenefits.map((benefit: string, index: number) => (
                          <li key={index} className="text-gray-700">{benefit}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {data.messaging.caseStudyReferences && data.messaging.caseStudyReferences.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Case Study References</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.messaging.caseStudyReferences.map((reference: string, index: number) => (
                          <li key={index} className="text-gray-700">{reference}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {data.messaging.supportingMaterials && data.messaging.supportingMaterials.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Supporting Materials</h4>
                      <div className="flex flex-wrap gap-2">
                        {data.messaging.supportingMaterials.map((material: string, index: number) => (
                          <span key={index} className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded">
                            {material}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {data.messaging.objectionHandling && data.messaging.objectionHandling.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Objection Handling</h4>
                      <div className="space-y-3">
                        {data.messaging.objectionHandling.map((item: any, index: number) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="mb-2">
                              <h5 className="font-medium text-red-700">Objection:</h5>
                              <p className="text-gray-700">{item.objection}</p>
                            </div>
                            <div>
                              <h5 className="font-medium text-green-700">Response:</h5>
                              <p className="text-gray-700">{item.response}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Next Steps */}
            {data.nextSteps && (
              <CollapsibleSection title="Next Steps & Success Metrics">
                <div className="space-y-4">
                  {data.nextSteps.immediateActions && data.nextSteps.immediateActions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Immediate Actions</h4>
                      <ul className="list-disc list-inside space-y-1 bg-green-50 p-4 rounded">
                        {data.nextSteps.immediateActions.map((action: string, index: number) => (
                          <li key={index} className="text-gray-700">{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {data.nextSteps.followUpSchedule && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Follow-up Schedule</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded">{data.nextSteps.followUpSchedule}</p>
                    </div>
                  )}
                  
                  {data.nextSteps.successMetrics && data.nextSteps.successMetrics.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Success Metrics</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {data.nextSteps.successMetrics.map((metric: string, index: number) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 p-3 rounded">
                            <p className="text-blue-800 font-medium text-sm">{metric}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {data.nextSteps.escalationTriggers && data.nextSteps.escalationTriggers.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Escalation Triggers</h4>
                      <ul className="list-disc list-inside space-y-1 bg-red-50 p-4 rounded">
                        {data.nextSteps.escalationTriggers.map((trigger: string, index: number) => (
                          <li key={index} className="text-red-700">{trigger}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactStrategyModal