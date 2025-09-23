import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { otpService } from '../../services/otp.service'
import { supabase } from '../../lib/supabaseClient'

interface ConfirmationButtonProps {
  email?: string
  otp: string
  flowType: 'new-user' | 'reset-password'
  buttonText: string
  onError?: (error: string) => void
  disabled?: boolean
}

export interface ConfirmationButtonRef {
  handleConfirmation: () => void
}

/**
 * Reusable confirmation button component
 * Follows Single Responsibility Principle - only handles OTP verification and redirect logic
 */
const ConfirmationButton = forwardRef<ConfirmationButtonRef, ConfirmationButtonProps>(({
  email,
  otp,
  flowType,
  buttonText,
  onError,
  disabled = false,
}, ref) => {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInitiallyDisabled, setIsInitiallyDisabled] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitiallyDisabled(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const handleConfirmation = async () => {
    if (!email) {
      onError?.('Missing email address. Please use the link from your email.')
      return
    }

    if (!otp || otp.length !== 6) {
      onError?.('Please enter a valid 6-digit verification code.')
      return
    }

    try {
      setIsSubmitting(true)

      // Verify OTP with backend
      const response = await otpService.verifyOtp({
        email,
        otp,
        type: flowType === 'new-user' ? 'signup' : 'recovery',
      })

      // If we received session data, set it in Supabase client
      if (response.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token,
        })

        if (sessionError) {
          console.error('Failed to set session:', sessionError)
          onError?.('Failed to establish authenticated session. Please try again.')
          setIsSubmitting(false)
          return
        }
      }

      // Navigate to the setup-password page with query params
      const url = new URL(response.redirectUrl)
      const searchParams = new URLSearchParams(url.search)

      router.navigate({
        to: '/setup-password',
        search: Object.fromEntries(searchParams.entries()),
      })
    } catch (err: any) {
      console.error('OTP verification error:', err)
      onError?.(err.message || 'Failed to verify code. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Expose handleConfirmation method to parent via ref
  useImperativeHandle(ref, () => ({
    handleConfirmation,
  }), [handleConfirmation])

  return (
    <button
      onClick={handleConfirmation}
      disabled={
        isSubmitting ||
        !email ||
        !otp ||
        otp.length !== 6 ||
        disabled ||
        isInitiallyDisabled
      }
      className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-700)] text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" />
          Verifying...
        </>
      ) : (
        buttonText
      )}
    </button>
  )
})

ConfirmationButton.displayName = 'ConfirmationButton'

export default ConfirmationButton
