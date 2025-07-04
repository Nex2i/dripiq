import React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  FileText,
  Package,
  Lightbulb,
  Target,
  MessageCircle,
  RefreshCw,
} from 'lucide-react'

// Types for the component props
interface AIAnalysisData {
  logo?: string | null
  brandColors?: string[]
  summary?: string
  products?: string[]
  services?: string[]
  differentiators?: string[]
  targetMarket?: string
  tone?: string
}

interface AIAnalysisSummaryProps {
  data: AIAnalysisData
  entityName?: string // Lead name or Organization name
  entityType?: 'lead' | 'organization'
  isEditable?: boolean
  onResync?: () => void
  isResyncing?: boolean
  formData?: AIAnalysisData
  onInputChange?: (field: string, value: string) => void
}

const AIAnalysisSummary: React.FC<AIAnalysisSummaryProps> = ({
  data,
  entityType = 'lead',
  isEditable = false,
  onResync,
  isResyncing = false,
  formData,
  onInputChange,
}) => {
  const displayData = isEditable ? formData || data : data

  const aiSummaryVisible =
    displayData.summary ||
    (displayData.products && displayData.products.length > 0) ||
    (displayData.services && displayData.services.length > 0) ||
    (displayData.differentiators && displayData.differentiators.length > 0) ||
    displayData.targetMarket ||
    displayData.tone

  const renderListField = (
    items: string[] | undefined,
    label: string,
    icon: React.ReactNode,
    helpText: string,
  ) => {
    if (!items || items.length === 0) return null

    return (
      <div className="group">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          {label}
        </label>
        <div className="relative">
          <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
          <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm min-h-[42px]">
            <ul className="space-y-1 text-gray-700">
              {items.map((item, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      </div>
    )
  }

  const renderTextField = (
    value: string | undefined,
    label: string,
    icon: React.ReactNode,
    helpText: string,
    fieldKey?: string,
  ) => {
    if (!value) return null

    return (
      <div className="group">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          {label}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
          {isEditable && fieldKey && onInputChange ? (
            <input
              type="text"
              value={value}
              onChange={(e) => onInputChange(fieldKey, e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                       placeholder:text-gray-400 
                       hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                       focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50"
            />
          ) : (
            <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm text-gray-700 cursor-default">
              {value}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      </div>
    )
  }

  const renderSummaryField = (
    summary: string | undefined,
    label: string,
    icon: React.ReactNode,
    helpText: string,
  ) => {
    if (!summary) return null

    return (
      <div className="group">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          {label}
        </label>
        <div className="relative">
          <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
            {icon}
          </div>
          <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm text-gray-700 cursor-default overflow-y-auto min-h-[200px] max-h-[400px]">
            <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-800 prose-strong:font-semibold prose-em:text-gray-600 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-code:text-gray-800 prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-300 prose-blockquote:text-gray-600 prose-blockquote:border-gray-300 prose-hr:border-gray-300">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* AI Summary Section */}
      {aiSummaryVisible ? (
        <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              AI Summary
            </h2>
            <div className="space-y-5">
              {/* Summary */}
              {renderSummaryField(
                displayData.summary,
                'Summary',
                <FileText className="h-4 w-4 text-gray-400" />,
                `A concise description of the ${entityType}`,
              )}

              {/* Products */}
              {renderListField(
                displayData.products,
                'Products',
                <Package className="h-4 w-4 text-gray-400" />,
                `List of the ${entityType}'s products`,
              )}

              {/* Services */}
              {renderListField(
                displayData.services,
                'Services',
                <Package className="h-4 w-4 text-gray-400" />,
                `List of the ${entityType}'s services`,
              )}

              {/* Differentiators */}
              {renderListField(
                displayData.differentiators,
                'Differentiators',
                <Lightbulb className="h-4 w-4 text-gray-400" />,
                `List of the ${entityType}'s differentiators`,
              )}

              {/* Target Market */}
              {renderTextField(
                displayData.targetMarket,
                'Target Market',
                <Target className="h-4 w-4 text-gray-400" />,
                `The ${entityType}'s target market`,
                'targetMarket',
              )}

              {/* Tone */}
              {renderTextField(
                displayData.tone,
                'Tone',
                <MessageCircle className="h-4 w-4 text-gray-400" />,
                `The ${entityType}'s tone`,
                'tone',
              )}
            </div>
          </div>
        </div>
      ) : (
        // Empty State for AI Summary
        <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              AI Summary
            </h2>
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                No AI Summary Available
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Run a resync to generate AI insights for this {entityType}.
              </p>
              {onResync && (
                <button
                  onClick={onResync}
                  disabled={isResyncing}
                  className="inline-flex items-center px-4 py-2 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isResyncing ? 'animate-spin' : ''}`}
                  />
                  {isResyncing ? 'Resyncing...' : 'Generate AI Summary'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AIAnalysisSummary
