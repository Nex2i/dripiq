import { UserPlus, Lock } from 'lucide-react'

export type AuthFlowType = 'new-user' | 'reset-password'

export interface AuthFlowContent {
  icon: typeof UserPlus | typeof Lock
  title: string
  subtitle: string
  buttonText: string
  instructionText: string
}

export interface AuthFlowParams {
  confirmationUrl?: string
  isInvited?: boolean
}

/**
 * Service responsible for determining authentication flow type and providing appropriate content
 * Follows Single Responsibility Principle - only handles flow type logic
 */
export class AuthFlowService {
  /**
   * Determine the authentication flow type based on URL parameters
   */
  static getFlowType(params: AuthFlowParams): AuthFlowType {
    const { confirmationUrl, isInvited } = params

    if (isInvited) return 'new-user'
    if (confirmationUrl && confirmationUrl.includes('recovery'))
      return 'reset-password'
    if (confirmationUrl && confirmationUrl.includes('invite')) return 'new-user'

    // Default fallback
    return 'reset-password'
  }

  /**
   * Get flow-specific content based on the flow type
   */
  static getFlowContent(flowType: AuthFlowType): AuthFlowContent {
    switch (flowType) {
      case 'new-user':
        return {
          icon: UserPlus,
          title: 'Complete Your Account Setup',
          subtitle:
            'Welcome to the team! Click the button below to set up your password and complete your account.',
          buttonText: 'Set Up My Account',
          instructionText:
            "You'll be redirected to complete your account setup securely.",
        }
      case 'reset-password':
        return {
          icon: Lock,
          title: 'Reset Your Password',
          subtitle: 'Click the button below to securely reset your password.',
          buttonText: 'Reset My Password',
          instructionText:
            "You'll be redirected to set your new password securely.",
        }
      default:
        throw new Error(`Unknown flow type: ${flowType}`)
    }
  }

  /**
   * Validate that required parameters are present for the flow
   */
  static validateFlowParams(params: AuthFlowParams): string | null {
    const { confirmationUrl } = params

    if (!confirmationUrl) {
      return 'Missing confirmation URL. Please use the link from your email.'
    }

    return null
  }
}
