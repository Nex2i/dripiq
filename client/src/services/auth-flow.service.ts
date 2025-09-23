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
  email?: string
  isInvited?: boolean
}

/**
 * Service responsible for determining authentication flow type and providing appropriate content
 * Follows Single Responsibility Principle - only handles flow type logic
 */
export class AuthFlowService {
  /**
   * Determine the authentication flow type based on parameters
   */
  static getFlowType(params: AuthFlowParams): AuthFlowType {
    const { isInvited } = params

    if (isInvited) return 'new-user'

    // Default fallback for password reset
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
            'Welcome to the team! Enter the verification code from your email to set up your password.',
          buttonText: 'Verify Code & Set Up Account',
          instructionText: 'Check your email for a 6-digit verification code.',
        }
      case 'reset-password':
        return {
          icon: Lock,
          title: 'Reset Your Password',
          subtitle:
            'Enter the verification code from your email to reset your password.',
          buttonText: 'Verify Code & Reset Password',
          instructionText: 'Check your email for a 6-digit verification code.',
        }
      default:
        throw new Error(`Unknown flow type: ${flowType}`)
    }
  }

  /**
   * Validate that required parameters are present for the flow
   */
  static validateFlowParams(params: AuthFlowParams): string | null {
    const { email } = params

    if (!email) {
      return 'Missing email address. Please use the link from your email.'
    }

    return null
  }
}
