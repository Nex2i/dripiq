import { useState } from 'react'
import { googleService } from '../../services/google.service'
import GoogleIcon from '../GoogleIcon'

interface GoogleProviderButtonProps {
  isConnected: boolean
  isDisabled?: boolean
  onError?: (error: string) => void
  onConnecting?: (isConnecting: boolean) => void
}

export default function GoogleProviderButton({
  isConnected,
  isDisabled = false,
  onError,
  onConnecting,
}: GoogleProviderButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    if (isDisabled || isConnecting || isConnected) return

    try {
      setIsConnecting(true)
      onConnecting?.(true)

      // Get the authorization URL from our backend
      const { authUrl, state } = await googleService.getGoogleAuthUrl()

      // Store the state for later verification
      sessionStorage.setItem('google_oauth_state', state)

      // Redirect to Google OAuth
      window.location.href = authUrl
    } catch (error) {
      console.error('Error initiating Google OAuth:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect with Google'
      onError?.(errorMessage)
    } finally {
      setIsConnecting(false)
      onConnecting?.(false)
    }
  }

  const buttonDisabled = isDisabled || isConnecting || isConnected

  return (
    <button
      onClick={handleConnect}
      disabled={buttonDisabled}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2 
        rounded-lg text-sm font-medium transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2
        ${
          isConnected
            ? 'bg-[var(--color-success-50)] text-[var(--color-success-700)] border border-[var(--color-success-200)] cursor-not-allowed'
            : isConnecting
              ? 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] cursor-not-allowed'
              : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-strong)]'
        }
      `}
      type="button"
    >
      {isConnecting ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border-default)] border-t-[var(--color-text-secondary)]" />
          <span>Connecting...</span>
        </>
      ) : isConnected ? (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Connected</span>
        </>
      ) : (
        <>
          <GoogleIcon />
          <span>Connect to Google</span>
        </>
      )}
    </button>
  )
}
