import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  
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

  const switchPrimaryMutation = useMutation({
    mutationFn: (providerId: string) => getUsersService().switchPrimaryProvider(providerId),
    onMutate: async (providerId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: userQueryKeys.emailProviders() })
      
      // Snapshot the previous value
      const previousProviders = queryClient.getQueryData(userQueryKeys.emailProviders())
      
      // Optimistically update the cache
      if (previousProviders && typeof previousProviders === 'object' && 'providers' in previousProviders) {
        const typedProviders = previousProviders as { providers: EmailProvider[] }
        const updatedProviders = typedProviders.providers.map((provider) => ({
          ...provider,
          isPrimary: provider.id === providerId
        }))
        
        queryClient.setQueryData(userQueryKeys.emailProviders(), { providers: updatedProviders })
      }
      
      return { previousProviders }
    },
    onError: (error, _providerId, context) => {
      // Rollback on error
      if (context?.previousProviders) {
        queryClient.setQueryData(userQueryKeys.emailProviders(), context.previousProviders)
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch primary provider'
      if (onError) {
        onError(errorMessage)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: userQueryKeys.emailProviders() })
    },
  })

  const getProviderStatus = (providerName: string): EmailProvider | null => {
    return (
      providersData?.providers.find((p) => p.provider === providerName) || null
    )
  }

  const handlePrimaryChange = (providerId: string) => {
    switchPrimaryMutation.mutate(providerId)
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
          onPrimaryChange={handlePrimaryChange}
          allProviders={providersData?.providers || []}
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
          onPrimaryChange={handlePrimaryChange}
          allProviders={providersData?.providers || []}
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
