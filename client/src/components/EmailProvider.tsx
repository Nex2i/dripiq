import { useQuery } from '@tanstack/react-query'
import { getUsersService, userQueryKeys } from '../services/users.service'
import type { EmailProvider } from '../services/users.service'
import ProviderCard from './ProviderCard'
import GoogleProviderButton from './GoogleProviderButton'
import GoogleIcon from './GoogleIcon'
import MicrosoftProviderButton from './MicrosoftProviderButton'
import MicrosoftIcon from './MicrosoftIcon'

interface EmailProviderProps {
  className?: string
  onError?: (error: string) => void
}

export default function EmailProvider({
  className = '',
  onError,
}: EmailProviderProps) {
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

  const getProviderStatus = (providerName: string): EmailProvider | null => {
    return (
      providersData?.providers.find((p) => p.provider === providerName) || null
    )
  }

  if (isLoading) {
    return (
      <div
        className={`bg-[var(--color-bg-primary)] rounded-xl shadow-sm ring-1 ring-[var(--color-border-default)] p-6 ${className}`}
      >
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Email Integration
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Connect your email providers to enable email sending.
        </p>
        <div className="animate-pulse">
          <div className="h-16 bg-[var(--color-bg-muted)] rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`bg-[var(--color-bg-primary)] rounded-xl shadow-sm ring-1 ring-[var(--color-border-default)] p-6 ${className}`}
      >
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Email Integration
        </h2>
        <div className="text-sm text-[var(--color-error-600)] mb-4">
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

  const googleProvider = getProviderStatus('google')
  const microsoftProvider = getProviderStatus('microsoft')

  return (
    <div
      className={`bg-[var(--color-bg-primary)] rounded-xl shadow-sm ring-1 ring-[var(--color-border-default)] p-6 ${className}`}
    >
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        Email Integration
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Connect your email providers to enable email sending.
      </p>

      <div className="space-y-3">
        <ProviderCard
          displayName="Google"
          icon={<GoogleIcon />}
          connectedProvider={googleProvider}
        >
          <GoogleProviderButton
            isConnected={googleProvider?.isConnected || false}
            onError={onError}
          />
        </ProviderCard>

        <ProviderCard
          displayName="Microsoft Outlook"
          icon={<MicrosoftIcon />}
          connectedProvider={microsoftProvider}
        >
          <MicrosoftProviderButton
            isConnected={microsoftProvider?.isConnected || false}
            onError={onError}
          />
        </ProviderCard>
      </div>
    </div>
  )
}
