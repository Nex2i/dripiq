import type { EmailProvider } from '../services/users.service'

interface ProviderCardProps {
  name: string
  displayName: string
  icon: React.ReactNode
  connectedProvider: EmailProvider | null
  children: React.ReactNode // The provider-specific button component
}

export default function ProviderCard({
  name,
  displayName,
  icon,
  connectedProvider,
  children,
}: ProviderCardProps) {
  const isConnected = connectedProvider?.isConnected || false

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="font-medium text-gray-900">{displayName}</h3>
            {isConnected && connectedProvider && (
              <p className="text-sm text-gray-500">
                Connected as{' '}
                {connectedProvider.displayName || connectedProvider.primaryEmail}
              </p>
            )}
          </div>
        </div>
        
        {children}
      </div>
    </div>
  )
}