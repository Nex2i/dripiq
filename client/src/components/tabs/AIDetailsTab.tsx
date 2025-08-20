import React from 'react'
import AIAnalysisSummary from '../AIAnalysisSummary'

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

interface AIDetailsTabProps {
  data: AIAnalysisData
  entityName: string
  entityType?: 'lead' | 'organization'
  onResync?: () => void
  isResyncing?: boolean
}

const AIDetailsTab: React.FC<AIDetailsTabProps> = ({
  data,
  entityName,
  entityType = 'lead',
  onResync,
  isResyncing = false,
}) => {
  return (
    <AIAnalysisSummary
      data={data}
      entityName={entityName}
      entityType={entityType}
      isEditable={false}
      onResync={onResync}
      isResyncing={isResyncing}
    />
  )
}

export default AIDetailsTab
