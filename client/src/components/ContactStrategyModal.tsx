import React, { useState, useEffect } from 'react'
import {
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Edit,
  Save,
  RotateCcw,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { leadsService } from '../services/leads.service'

interface ContactStrategyModalProps {
  isOpen: boolean
  onClose: () => void
  data: any
  contactName: string
  companyName: string
  leadId?: string
  contactId?: string
  onDataUpdate?: (updatedData: any) => void
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

// Editable input component - defined outside to prevent re-creation on each render
const EditableInput: React.FC<{
  value: string
  onChange: (value: string) => void
  label: string
  isEditing: boolean
  type?: 'text' | 'time'
  placeholder?: string
  className?: string
  copiedItem?: string | null
  onCopy?: (text: string, id: string) => void
}> = ({
  value,
  onChange,
  label,
  isEditing,
  type = 'text',
  placeholder,
  className = '',
  copiedItem,
  onCopy,
}) => {
  if (isEditing) {
    return (
      <div className={`border border-gray-300 rounded-lg p-3 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}:
        </label>
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    )
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium text-gray-700">{label}:</h5>
        {onCopy && (
          <button
            onClick={() => onCopy(value, `${label.toLowerCase()}-copy`)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded transition-colors"
            title={`Copy ${label.toLowerCase()}`}
          >
            {copiedItem === `${label.toLowerCase()}-copy` ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
        {value}
      </p>
    </div>
  )
}

// Editable textarea component - defined outside to prevent re-creation on each render
const EditableTextarea: React.FC<{
  value: string
  onChange: (value: string) => void
  label: string
  isEditing: boolean
  placeholder?: string
  rows?: number
  className?: string
  copiedItem?: string | null
  onCopy?: (text: string, id: string) => void
}> = ({
  value,
  onChange,
  label,
  isEditing,
  placeholder,
  rows = 4,
  className = '',
  copiedItem,
  onCopy,
}) => {
  if (isEditing) {
    return (
      <div className={`border border-gray-300 rounded-lg p-3 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}:
        </label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    )
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium text-gray-700">{label}:</h5>
        {onCopy && (
          <button
            onClick={() => onCopy(value, `${label.toLowerCase()}-copy`)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded transition-colors"
            title={`Copy ${label.toLowerCase()}`}
          >
            {copiedItem === `${label.toLowerCase()}-copy` ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
        {value}
      </p>
    </div>
  )
}

// Delay dropdown component with preset values
const DelaySelector: React.FC<{
  value: string
  onChange: (value: string) => void
  label: string
  isEditing: boolean
  className?: string
  copiedItem?: string | null
  onCopy?: (text: string, id: string) => void
}> = ({
  value,
  onChange,
  label,
  isEditing,
  className = '',
  copiedItem,
  onCopy,
}) => {
  const delayOptions = [
    { value: 'PT0S', label: 'Immediately' },
    { value: 'PT5M', label: '5 minutes' },
    { value: 'PT15M', label: '15 minutes' },
    { value: 'PT30M', label: '30 minutes' },
    { value: 'PT1H', label: '1 hour' },
    { value: 'PT2H', label: '2 hours' },
    { value: 'PT4H', label: '4 hours' },
    { value: 'PT6H', label: '6 hours' },
    { value: 'PT12H', label: '12 hours' },
    { value: 'PT24H', label: '1 day' },
    { value: 'P2D', label: '2 days' },
    { value: 'P3D', label: '3 days' },
  ]

  const getDisplayLabel = (isoValue: string) => {
    const option = delayOptions.find((opt) => opt.value === isoValue)
    return option ? option.label : isoValue
  }

  if (isEditing) {
    return (
      <div className={`border border-gray-300 rounded-lg p-3 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}:
        </label>
        <select
          value={value || 'PT0S'}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {delayOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium text-gray-700">{label}:</h5>
        {onCopy && (
          <button
            onClick={() => onCopy(value, `${label.toLowerCase()}-copy`)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded transition-colors"
            title={`Copy ${label.toLowerCase()}`}
          >
            {copiedItem === `${label.toLowerCase()}-copy` ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
        {getDisplayLabel(value)} ({value})
      </p>
    </div>
  )
}

const ContactStrategyModal: React.FC<ContactStrategyModalProps> = ({
  isOpen,
  onClose,
  data,
  contactName,
  companyName,
  leadId,
  contactId,
  onDataUpdate,
}) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedData, setEditedData] = useState<any>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Initialize edited data when data changes
  useEffect(() => {
    if (data) {
      setEditedData(JSON.parse(JSON.stringify(data)))
      setIsEditMode(false)
      setHasUnsavedChanges(false)
    }
  }, [data])

  // Update strategy mutation
  const updateStrategyMutation = useMutation({
    mutationFn: () => {
      if (!leadId || !contactId || !editedData) {
        throw new Error('Missing required data for update')
      }
      return leadsService.updateContactStrategy(leadId, contactId, editedData)
    },
    onSuccess: (result) => {
      setEditedData(result)
      onDataUpdate?.(result)
      setIsEditMode(false)
      setHasUnsavedChanges(false)
    },
    onError: (error) => {
      console.error('Failed to update contact strategy:', error)
    },
  })

  if (!isOpen || !data) return null

  const currentData = isEditMode ? editedData : data

  // Handle field updates
  const updateField = (path: (string | number)[], value: any) => {
    if (!editedData) return

    const newData = JSON.parse(JSON.stringify(editedData))
    let current = newData

    // Navigate to the correct nested object
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      if (!current[key]) {
        current[key] = {}
      }
      current = current[key]
    }

    current[path[path.length - 1]] = value
    setEditedData(newData)
    setHasUnsavedChanges(true)
  }

  // Handle save
  const handleSave = () => {
    updateStrategyMutation.mutate()
  }

  // Handle cancel
  const handleCancel = () => {
    setEditedData(JSON.parse(JSON.stringify(data)))
    setIsEditMode(false)
    setHasUnsavedChanges(false)
  }

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasUnsavedChanges && isEditMode) {
      if (
        window.confirm(
          'You have unsaved changes. Are you sure you want to close?',
        )
      ) {
        handleCancel()
        onClose()
      }
    } else {
      onClose()
    }
  }

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(itemId)
      setTimeout(() => setCopiedItem(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // Render a single node from the campaign plan
  const renderNode = (node: any, index: number) => {
    const nodeFromCurrentData = currentData.nodes?.[index] || node
    const actionColor =
      nodeFromCurrentData.action === 'send'
        ? 'bg-blue-100 text-blue-800'
        : nodeFromCurrentData.action === 'wait'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-200 text-gray-800'

    const headerRight = (
      <div className="flex items-center space-x-2">
        <span
          title={`${nodeFromCurrentData.action}-${nodeFromCurrentData.id}-${index}`}
          className={`text-xs font-medium px-2.5 py-0.5 rounded ${actionColor}`}
        >
          {nodeFromCurrentData.action}
        </span>
        {nodeFromCurrentData.channel && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-gray-100 text-gray-800">
            {nodeFromCurrentData.channel}
          </span>
        )}
      </div>
    )

    return (
      <div
        key={nodeFromCurrentData.id || index}
        className="border border-gray-200 rounded-lg p-4 mb-4 bg-white"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 text-lg">
            {nodeFromCurrentData.id}
          </h4>
          {headerRight}
        </div>

        <div className="space-y-3">
          {nodeFromCurrentData.action === 'send' && (
            <div className="space-y-3">
              {nodeFromCurrentData.subject !== undefined && (
                <EditableInput
                  value={nodeFromCurrentData.subject || ''}
                  onChange={(value) =>
                    updateField(['nodes', index, 'subject'], value)
                  }
                  label="Subject"
                  isEditing={isEditMode}
                  placeholder="Email subject line"
                  copiedItem={copiedItem}
                  onCopy={copyToClipboard}
                />
              )}
              {nodeFromCurrentData.body !== undefined && (
                <EditableTextarea
                  value={nodeFromCurrentData.body || ''}
                  onChange={(value) =>
                    updateField(['nodes', index, 'body'], value)
                  }
                  label="Body"
                  isEditing={isEditMode}
                  placeholder="Email message body"
                  rows={6}
                  copiedItem={copiedItem}
                  onCopy={copyToClipboard}
                />
              )}
              {nodeFromCurrentData.schedule && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nodeFromCurrentData.schedule.delay !== undefined && (
                    <DelaySelector
                      value={nodeFromCurrentData.schedule.delay || ''}
                      onChange={(value) =>
                        updateField(
                          ['nodes', index, 'schedule', 'delay'],
                          value,
                        )
                      }
                      label="Delay"
                      isEditing={isEditMode}
                      className="bg-white"
                      copiedItem={copiedItem}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {nodeFromCurrentData.schedule.at !== undefined && (
                    <EditableInput
                      value={nodeFromCurrentData.schedule.at || ''}
                      onChange={() => {}} // Read-only
                      label="Schedule At"
                      isEditing={false}
                      className="bg-white"
                      copiedItem={copiedItem}
                      onCopy={copyToClipboard}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {Array.isArray(nodeFromCurrentData.transitions) &&
            nodeFromCurrentData.transitions.length > 0 && (
              <div className="mt-2">
                <h5 className="font-medium text-gray-800 mb-2">Transitions</h5>
                <div className="space-y-2">
                  {nodeFromCurrentData.transitions.map(
                    (t: any, tIndex: number) => (
                      <div
                        key={`${nodeFromCurrentData.id}-t-${tIndex}`}
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
                    ),
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    )
  }

  const formatPlanForCopy = () => {
    try {
      return JSON.stringify(currentData, null, 2)
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
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-semibold">Contact Strategy</h2>
                {isEditMode && (
                  <span className="bg-yellow-500 text-yellow-900 px-2 py-1 rounded text-xs font-medium">
                    Editing
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-[var(--color-primary-100)] mt-1">
                {contactName} at {companyName}
              </p>
              <p className="text-[var(--color-primary-100)] mt-1">
                {leadId} {contactId}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isEditMode ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={
                      updateStrategyMutation.isPending || !hasUnsavedChanges
                    }
                    className="bg-green-600 hover:bg-green-500 disabled:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    {updateStrategyMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={updateStrategyMutation.isPending}
                    className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </>
              ) : (
                <>
                  {leadId && contactId && (
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-400)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                  )}
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
                </>
              )}
              <button
                onClick={handleClose}
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
                  {currentData.timezone && (
                    <EditableInput
                      value={currentData.timezone}
                      onChange={() => {}} // Read-only
                      label="Timezone"
                      isEditing={false}
                      className="bg-white"
                      copiedItem={copiedItem}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {currentData.startNodeId && (
                    <EditableInput
                      value={currentData.startNodeId}
                      onChange={() => {}} // Read-only
                      label="Start Node"
                      isEditing={false}
                      className="bg-white"
                      copiedItem={copiedItem}
                      onCopy={copyToClipboard}
                    />
                  )}
                </div>
                {currentData.quietHours && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditableInput
                      value={currentData.quietHours.start}
                      onChange={() => {}} // Read-only
                      label="Quiet Hours Start"
                      isEditing={false}
                      className="bg-white"
                      copiedItem={copiedItem}
                      onCopy={copyToClipboard}
                    />
                    <EditableInput
                      value={currentData.quietHours.end}
                      onChange={() => {}} // Read-only
                      label="Quiet Hours End"
                      isEditing={false}
                      className="bg-white"
                      copiedItem={copiedItem}
                      onCopy={copyToClipboard}
                    />
                  </div>
                )}
                {currentData.defaults?.timers && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentData.defaults.timers.no_open_after && (
                      <EditableInput
                        value={currentData.defaults.timers.no_open_after}
                        onChange={() => {}} // Read-only
                        label="Default No Open After"
                        isEditing={false}
                        className="bg-white"
                        copiedItem={copiedItem}
                        onCopy={copyToClipboard}
                      />
                    )}
                    {currentData.defaults.timers.no_click_after && (
                      <EditableInput
                        value={currentData.defaults.timers.no_click_after}
                        onChange={() => {}} // Read-only
                        label="Default No Click After"
                        isEditing={false}
                        className="bg-white"
                        copiedItem={copiedItem}
                        onCopy={copyToClipboard}
                      />
                    )}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Nodes */}
            {Array.isArray(currentData.nodes) &&
            currentData.nodes.length > 0 ? (
              <CollapsibleSection
                title={`Nodes (${currentData.nodes.length})`}
                defaultExpanded={true}
              >
                <div className="space-y-4">
                  {currentData.nodes.map((node: any, index: number) =>
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
