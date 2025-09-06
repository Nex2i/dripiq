import type { EmailProvider } from '../services/users.service'

interface ProviderCardProps {
  displayName: string
  icon: React.ReactNode
  connectedProvider: EmailProvider | null
  children: React.ReactNode // The provider-specific button component
}

export default function ProviderCard({
  displayName,
  icon,
  connectedProvider,
  children,
}: ProviderCardProps) {
  const isConnected = connectedProvider?.isConnected || false

  return (
    <div className="border border-[var(--color-border-default)] rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">
              {displayName}
            </h3>
            {isConnected && connectedProvider && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Connected as{' '}
                {connectedProvider.displayName ||
                  connectedProvider.primaryEmail}
              </p>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
