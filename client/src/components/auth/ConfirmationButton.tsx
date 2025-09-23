import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface ConfirmationButtonProps {
  confirmationUrl?: string
  buttonText: string
  onError?: (error: string) => void
  disabled?: boolean
}

/**
 * Reusable confirmation button component
 * Follows Single Responsibility Principle - only handles confirmation redirect logic
 */
export default function ConfirmationButton({
  confirmationUrl,
  buttonText,
  onError,
  disabled = false,
}: ConfirmationButtonProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isInitiallyDisabled, setIsInitiallyDisabled] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitiallyDisabled(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const handleConfirmation = () => {
    if (!confirmationUrl) {
      onError?.(
        'Missing confirmation URL. Please use the link from your email.',
      )
      return
    }

    try {
      setIsRedirecting(true)

      // Redirect to the confirmation URL
      window.location.href = confirmationUrl
    } catch (err: any) {
      console.error('Redirect error:', err)
      onError?.('Failed to redirect to password setup. Please try again.')
      setIsRedirecting(false)
    }
  }

  return (
    <button
      onClick={handleConfirmation}
      disabled={
        isRedirecting || !confirmationUrl || disabled || isInitiallyDisabled
      }
      className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-700)] text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
      {isRedirecting ? (
        <>
          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" />
          Redirecting...
        </>
      ) : (
        buttonText
      )}
    </button>
  )
}
