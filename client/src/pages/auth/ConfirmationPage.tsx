import { useState, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import AuthLayout from '../../components/auth/AuthLayout'
import FlowInformation from '../../components/auth/FlowInformation'
import ErrorDisplay from '../../components/auth/ErrorDisplay'
import ConfirmationButton from '../../components/auth/ConfirmationButton'
import OtpInput from '../../components/auth/OtpInput'
import { AuthFlowService } from '../../services/auth-flow.service'

/**
 * Confirmation page component that follows Single Responsibility Principle
 * Responsible only for orchestrating the confirmation flow
 */
export default function ConfirmationPage() {
  const search = useSearch({ strict: false }) as any
  const email = search?.email
  const isInvited = search?.invited === 'true'

  const [error, setError] = useState('')
  const [otp, setOtp] = useState('')

  // Use the service to determine flow type and get content
  const flowType = AuthFlowService.getFlowType({ email, isInvited })
  const flowContent = AuthFlowService.getFlowContent(flowType)

  // Validate flow parameters
  useEffect(() => {
    const validationError = AuthFlowService.validateFlowParams({
      email,
      isInvited,
    })
    if (validationError) {
      setError(validationError)
    }
  }, [email, isInvited])

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  return (
    <AuthLayout>
      <FlowInformation flowContent={flowContent} />

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
        <div className="space-y-6">
          <ErrorDisplay error={error} />

          {!error && (
            <>
              <div className="space-y-4">
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <OtpInput
                    length={6}
                    value={otp}
                    onChange={setOtp}
                    disabled={!!error}
                  />
                </div>
              </div>

              <ConfirmationButton
                email={email}
                otp={otp}
                flowType={flowType}
                buttonText={flowContent.buttonText}
                onError={handleError}
                disabled={!!error}
              />
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
