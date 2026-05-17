import { Plug } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { ZoomInfoIntegrationAuth } from './integrations/ZoomInfoIntegrationAuth'

export default function IntegrationsPage() {
  const { user } = useAuth()
  const isAdmin = user?.tenants?.[0]?.role?.name === 'Admin'

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plug className="h-5 w-5 text-[var(--color-primary-600)]" />
          Integrations
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Connect third-party data providers for your workspace. Configured
          integrations are shared with your team for lead analysis and
          enrichment.
        </p>
      </header>

      {!isAdmin ? (
        <p className="text-sm text-gray-600">
          You need administrator access to manage workspace integrations.
        </p>
      ) : (
        <section className="space-y-6" aria-label="Integration providers">
          <ZoomInfoIntegrationAuth />
        </section>
      )}
    </div>
  )
}
