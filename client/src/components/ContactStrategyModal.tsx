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
  }> = ({ text, id, label, className = '', showBorder = true }) => (
    <div
      className={`${showBorder ? 'border border-gray-200 rounded-lg p-3' : ''} ${className}`}
    >
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
      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
        {text}
      </p>
    </div>
  )

  // Render a single node from the campaign plan
  const renderNode = (node: any, index: number) => {
    const actionColor =
      node.action === 'send'
        ? 'bg-blue-100 text-blue-800'
        : node.action === 'wait'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-200 text-gray-800'

    const headerRight = (
      <div className="flex items-center space-x-2">
        <span
          title={`${node.action}-${node.id}-${index}`}
          className={`text-xs font-medium px-2.5 py-0.5 rounded ${actionColor}`}
        >
          {node.action}
        </span>
        {node.channel && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-gray-100 text-gray-800">
            {node.channel}
          </span>
        )}
      </div>
    )

    return (
      <div
        key={node.id || index}
        className="border border-gray-200 rounded-lg p-4 mb-4 bg-white"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 text-lg">{node.id}</h4>
          {headerRight}
        </div>

        <div className="space-y-3">
          {node.action === 'send' && (
            <div className="space-y-3">
              {node.subject && (
                <CopyableText
                  text={node.subject}
                  id={`subject-${index}`}
                  label="Subject"
                />
              )}
              {node.body && (
                <CopyableText
                  text={node.body}
                  id={`body-${index}`}
                  label="Body"
                />
              )}
              {node.senderIdentityId && (
                <CopyableText
                  text={node.senderIdentityId}
                  id={`sender-${index}`}
                  label="Sender Identity Override"
                />
              )}
              {node.schedule && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {node.schedule.delay && (
                    <CopyableText
                      text={node.schedule.delay}
                      id={`delay-${index}`}
                      label="Delay"
                      showBorder={false}
                      className="bg-white p-3 rounded border"
                    />
                  )}
                  {node.schedule.at && (
                    <CopyableText
                      text={node.schedule.at}
                      id={`at-${index}`}
                      label="Schedule At"
                      showBorder={false}
                      className="bg-white p-3 rounded border"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {Array.isArray(node.transitions) && node.transitions.length > 0 && (
            <div className="mt-2">
              <h5 className="font-medium text-gray-800 mb-2">Transitions</h5>
              <div className="space-y-2">
                {node.transitions.map((t: any, tIndex: number) => (
                  <div
                    key={`${node.id}-t-${tIndex}`}
                    className="flex items-center justify-between p-3 rounded border bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-green-100 text-green-800">
                        on: {t.on}
                      </span>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-purple-100 text-purple-800">
                        to: {t.to}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {t.within
                        ? `within ${t.within}`
                        : t.after
                          ? `after ${t.after}`
                          : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const formatPlanForCopy = () => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-primary-100)] mt-1">
                {contactName} at {companyName}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() =>
                  copyToClipboard(formatPlanForCopy(), 'full-plan-json')
                }
                className="bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-400)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                {copiedItem === 'full-plan-json' ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy JSON</span>
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
            {/* Plan Overview */}
            <CollapsibleSection title="Plan Overview" defaultExpanded={true}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.timezone && (
                    <CopyableText
                      text={data.timezone}
                      id="timezone"
                      label="Timezone"
                      showBorder={false}
                      className="bg-white p-3 rounded border"
                    />
                  )}
                  {data.startNodeId && (
                    <CopyableText
                      text={data.startNodeId}
                      id="startNodeId"
                      label="Start Node"
                      showBorder={false}
                      className="bg-white p-3 rounded border"
                    />
                  )}
                </div>
                {data.quietHours && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CopyableText
                      text={data.quietHours.start}
                      id="quiet-start"
                      label="Quiet Hours Start"
                      showBorder={false}
                      className="bg-white p-3 rounded border"
                    />
                    <CopyableText
                      text={data.quietHours.end}
                      id="quiet-end"
                      label="Quiet Hours End"
                      showBorder={false}
                      className="bg-white p-3 rounded border"
                    />
                  </div>
                )}
                {data.defaults?.timers && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.defaults.timers.no_open_after && (
                      <CopyableText
                        text={data.defaults.timers.no_open_after}
                        id="no-open-after"
                        label="Default No Open After"
                        showBorder={false}
                        className="bg-white p-3 rounded border"
                      />
                    )}
                    {data.defaults.timers.no_click_after && (
                      <CopyableText
                        text={data.defaults.timers.no_click_after}
                        id="no-click-after"
                        label="Default No Click After"
                        showBorder={false}
                        className="bg-white p-3 rounded border"
                      />
                    )}
                  </div>
                )}
                {data.senderIdentityId && (
                  <CopyableText
                    text={data.senderIdentityId}
                    id="plan-sender"
                    label="Default Sender Identity"
                    showBorder={true}
                  />
                )}
              </div>
            </CollapsibleSection>

            {/* Nodes */}
            {Array.isArray(data.nodes) && data.nodes.length > 0 ? (
              <CollapsibleSection
                title={`Nodes (${data.nodes.length})`}
                defaultExpanded={true}
              >
                <div className="space-y-4">
                  {data.nodes.map((node: any, index: number) =>
                    renderNode(node, index),
                  )}
                </div>
              </CollapsibleSection>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <p className="text-lg font-medium">No nodes found</p>
                  <p className="text-sm mt-2">
                    The campaign plan appears to be empty or invalid.
                  </p>
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
