import { Mail } from 'lucide-react'
import type { AuthFlowContent, AuthFlowType } from '../../services/auth-flow.service'

interface FlowInformationProps {
  flowContent: AuthFlowContent
  flowType: AuthFlowType
  confirmationUrl?: string
}

/**
 * Component responsible for displaying flow-specific information
 * Follows Single Responsibility Principle - only handles information display
 */
export default function FlowInformation({ flowContent, flowType, confirmationUrl }: FlowInformationProps) {
  return (
    <>
      {/* Flow header */}
      <div className="text-center">
        <flowContent.icon className="mx-auto h-12 w-12 text-[var(--color-primary-600)]" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {flowContent.title}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {flowContent.subtitle}
        </p>
      </div>

      {/* Information section */}
      <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center mb-2">
          <Mail className="w-4 h-4 mr-2 text-[var(--color-primary-600)]" />
          <p className="font-medium">What happens next:</p>
        </div>
        <ul className="space-y-1 ml-6">
          <li>• {flowContent.instructionText}</li>
          <li>• You'll be able to set your password on the next page</li>
          <li>• The link is secure and will expire for your safety</li>
        </ul>
      </div>

      {/* Confirmation URL display (for debugging/verification) */}
      {confirmationUrl && (
        <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
          <p className="font-medium mb-1">Confirmation link ready:</p>
          <p className="break-all font-mono">
            {confirmationUrl.substring(0, 60)}...
          </p>
        </div>
      )}

      {/* Additional help text */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          Having trouble? Check your email for the original {flowType === 'new-user' ? 'invitation' : 'password reset'} message and use that link instead.
        </p>
      </div>
    </>
  )
}