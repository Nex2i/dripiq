import { useState } from 'react'
import { googleService } from '../services/google.service'

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
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${
          isConnected
            ? 'bg-green-50 text-green-700 border border-green-200 cursor-not-allowed'
            : isConnecting
              ? 'bg-gray-50 text-gray-500 border border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
        }
      `}
      type="button"
    >
      {isConnecting ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
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
        <span>Connect</span>
      )}
    </button>
  )
}