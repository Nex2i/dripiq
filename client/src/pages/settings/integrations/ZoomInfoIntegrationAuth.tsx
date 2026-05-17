import { Loader2, AlertCircle, Check, Trash2, FlaskConical } from 'lucide-react'
import { useZoomInfoIntegration } from '../../../hooks/useZoomInfoIntegration'

export function ZoomInfoIntegrationAuth() {
  const {
    loading,
    configured,
    clientIdMasked,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    error,
    success,
    saving,
    testing,
    removing,
    handleTest,
    handleSave,
    handleRemove,
  } = useZoomInfoIntegration()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading ZoomInfo…
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-medium text-gray-900">ZoomInfo</h3>
      <p className="mt-1 text-sm text-gray-600">
        Register OAuth client credentials from the ZoomInfo developer portal.
        Required scopes:{' '}
        <code className="text-xs bg-gray-100 px-1 rounded">
          api:data:company
        </code>
        ,{' '}
        <code className="text-xs bg-gray-100 px-1 rounded">
          api:data:contact
        </code>
        .
      </p>

      {configured && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-100 rounded-md px-3 py-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          Connected
          {clientIdMasked ? (
            <span className="text-gray-700">
              · Client ID <span className="font-mono">{clientIdMasked}</span>
            </span>
          ) : null}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-100 rounded-md px-3 py-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="zi-client-id"
            className="block text-sm font-medium text-gray-700"
          >
            Client ID
          </label>
          <input
            id="zi-client-id"
            type="text"
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary-500)] focus:ring-[var(--color-primary-500)]"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="zi-client-secret"
            className="block text-sm font-medium text-gray-700"
          >
            Client secret
          </label>
          <input
            id="zi-client-secret"
            type="password"
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary-500)] focus:ring-[var(--color-primary-500)]"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={testing}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FlaskConical className="h-4 w-4" />
          )}
          Test connection
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary-600)] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--color-primary-700)] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save credentials
        </button>
        {configured && (
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={removing}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
