import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getUsersService, userQueryKeys } from '../services/users.service'
import type { EmailProvider } from '../services/users.service'
import { googleService } from '../services/google.service'

interface EmailProviderProps {
  className?: string
  onError?: (error: string) => void
}

interface ProviderConfig {
  name: string
  displayName: string
  icon: React.ReactNode
  connectHandler: () => Promise<void>
}

export default function EmailProvider({
  className = '',
  onError,
}: EmailProviderProps) {
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  )

  const {
    data: providersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: userQueryKeys.emailProviders(),
    queryFn: () => getUsersService().getEmailProviders(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const handleGoogleConnect = async () => {
    try {
      setConnectingProvider('google')

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
      setConnectingProvider(null)
    }
  }

  const providerConfigs: Record<string, ProviderConfig> = {
    google: {
      name: 'google',
      displayName: 'Google',
      icon: (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      ),
      connectHandler: handleGoogleConnect,
    },
  }

  const getProviderStatus = (providerName: string): EmailProvider | null => {
    return (
      providersData?.providers.find((p) => p.provider === providerName) || null
    )
  }

  const renderProviderCard = (config: ProviderConfig) => {
    const connectedProvider = getProviderStatus(config.name)
    const isConnected = connectedProvider?.isConnected || false
    const isConnecting = connectingProvider === config.name
    const isDisabled = isConnected || isConnecting

    return (
      <div key={config.name} className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className="font-medium text-gray-900">
                {config.displayName}
              </h3>
              {isConnected && connectedProvider && (
                <p className="text-sm text-gray-500">
                  Connected as{' '}
                  {connectedProvider.displayName ||
                    connectedProvider.primaryEmail}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={config.connectHandler}
            disabled={isDisabled}
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
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6 ${className}`}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Email Integration
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Connect your email providers to enable email sending.
        </p>
        <div className="animate-pulse">
          <div className="h-16 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6 ${className}`}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Email Integration
        </h2>
        <div className="text-sm text-red-600 mb-4">
          Failed to load email providers.
          <button
            onClick={() => refetch()}
            className="ml-1 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6 ${className}`}
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Email Integration
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Connect your email providers to enable email sending.
      </p>

      <div className="space-y-3">
        {Object.values(providerConfigs).map((config) =>
          renderProviderCard(config),
        )}
      </div>
    </div>
  )
}
