import { useState, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import AuthLayout from '../../components/auth/AuthLayout'
import FlowInformation from '../../components/auth/FlowInformation'
import ErrorDisplay from '../../components/auth/ErrorDisplay'
import ConfirmationButton from '../../components/auth/ConfirmationButton'
import { AuthFlowService } from '../../services/auth-flow.service'

/**
 * Confirmation page component that follows Single Responsibility Principle
 * Responsible only for orchestrating the confirmation flow
 */
export default function ConfirmationPage() {
  const search = useSearch({ strict: false }) as any
  const confirmationUrl = search?.confirmation_url
  const isInvited = search?.invited === 'true'

  const [error, setError] = useState('')

  // Use the service to determine flow type and get content
  const flowType = AuthFlowService.getFlowType({ confirmationUrl, isInvited })
  const flowContent = AuthFlowService.getFlowContent(flowType)

  // Validate flow parameters
  useEffect(() => {
    const validationError = AuthFlowService.validateFlowParams({ confirmationUrl, isInvited })
    if (validationError) {
      setError(validationError)
    }
  }, [confirmationUrl, isInvited])

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  return (
    <AuthLayout>
      <FlowInformation 
        flowContent={flowContent}
        flowType={flowType}
        confirmationUrl={confirmationUrl}
      />

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
        <div className="space-y-6">
          <ErrorDisplay error={error} />

          <ConfirmationButton
            confirmationUrl={confirmationUrl}
            buttonText={flowContent.buttonText}
            onError={handleError}
            disabled={!!error}
          />
        </div>
      </div>
    </AuthLayout>
  )
}