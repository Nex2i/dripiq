import type { EmailProvider } from '../services/users.service'

interface ProviderCardProps {
  displayName: string
  icon: React.ReactNode
  connectedProvider: EmailProvider | null
  children: React.ReactNode // The provider-specific button component
  onPrimaryChange?: (providerId: string) => void
  allProviders?: EmailProvider[]
  isChangingPrimary?: boolean
}

export default function ProviderCard({
  displayName,
  icon,
  connectedProvider,
  children,
  onPrimaryChange,
  allProviders: _allProviders = [],
  isChangingPrimary = false,
}: ProviderCardProps) {
  const isConnected = connectedProvider?.isConnected || false
  const isPrimary = connectedProvider?.isPrimary || false

  const handlePrimaryChange = () => {
    if (isConnected && connectedProvider && onPrimaryChange) {
      onPrimaryChange(connectedProvider.id)
    }
  }

  return (
    <div className="border border-[var(--color-border-default)] rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[var(--color-text-primary)]">
                {displayName}
              </h3>
              {isPrimary && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  Primary
                </span>
              )}
            </div>
            {isConnected && connectedProvider && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Connected as{' '}
                {connectedProvider.displayName ||
                  connectedProvider.primaryEmail}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 h-full">
          {/* Primary provider radio button - only show for connected providers */}
          {isConnected && onPrimaryChange && (
            <div className="flex items-center">
              <input
                type="radio"
                id={`primary-${connectedProvider?.id}`}
                name="primary-provider"
                checked={isPrimary}
                onChange={handlePrimaryChange}
                disabled={isChangingPrimary}
                className={`w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2 ${
                  isChangingPrimary ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              />
              <label
                htmlFor={`primary-${connectedProvider?.id}`}
                className="ml-2 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer select-none"
              >
                Primary
              </label>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  )
}
