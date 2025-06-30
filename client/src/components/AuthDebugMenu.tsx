import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/auth.service'

interface AuthDebugMenuProps {
  className?: string
}

export function AuthDebugMenu({ className = '' }: AuthDebugMenuProps) {
  const { user, session, loading, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isForceLoggingOut, setIsForceLoggingOut] = useState(false)

  // Only show in development
  if (import.meta.env.PROD) {
    return null
  }

  const handleForceLogout = async () => {
    setIsForceLoggingOut(true)
    try {
      await logout()
      console.log('🔐 Debug: Force logout completed')
    } catch (error) {
      console.error('🔐 Debug: Force logout failed:', error)
    } finally {
      setIsForceLoggingOut(false)
    }
  }

  const handleRefreshAuthState = async () => {
    try {
      const currentSession = await authService.getCurrentSession()
      const currentUser = await authService.getCurrentUser()
      console.log('🔐 Debug: Auth state refreshed', {
        currentSession,
        currentUser,
      })
    } catch (error) {
      console.error('🔐 Debug: Failed to refresh auth state:', error)
    }
  }

  const copyAuthStateToClipboard = () => {
    const authState = {
      user,
      session: session
        ? {
            access_token: session.access_token ? '[REDACTED]' : null,
            refresh_token: session.refresh_token ? '[REDACTED]' : null,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            token_type: session.token_type,
            user: {
              id: session.user?.id,
              email: session.user?.email,
              email_confirmed_at: session.user?.email_confirmed_at,
            },
          }
        : null,
      loading,
      timestamp: new Date().toISOString(),
    }

    navigator.clipboard.writeText(JSON.stringify(authState, null, 2))
    console.log('🔐 Debug: Auth state copied to clipboard')
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className="relative">
        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-mono flex items-center gap-2 transition-colors"
          title="Auth Debug Menu (Dev Only)"
        >
          🔐
          <span
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>

        {/* Debug Panel */}
        {isOpen && (
          <div className="absolute top-12 right-0 bg-gray-900 text-white p-4 rounded-lg shadow-xl min-w-80 max-w-96 font-mono text-xs border border-gray-700">
            <div className="space-y-3">
              {/* Auth Status */}
              <div>
                <div className="text-orange-400 font-semibold mb-1">
                  Auth Status:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Loading:</div>
                  <div
                    className={loading ? 'text-yellow-400' : 'text-green-400'}
                  >
                    {loading ? 'true' : 'false'}
                  </div>
                  <div>Authenticated:</div>
                  <div className={user ? 'text-green-400' : 'text-red-400'}>
                    {user ? 'true' : 'false'}
                  </div>
                  <div>Session:</div>
                  <div className={session ? 'text-green-400' : 'text-red-400'}>
                    {session ? 'active' : 'none'}
                  </div>
                </div>
              </div>

              {/* User Info */}
              {user && (
                <div>
                  <div className="text-orange-400 font-semibold mb-1">
                    User Info:
                  </div>
                  <div className="bg-gray-800 p-2 rounded border text-xs space-y-1">
                    <div>ID: {user.user.id}</div>
                    <div>Email: {user.user.email}</div>
                    <div>Name: {user.user.name || 'N/A'}</div>
                    <div>Tenants: {user.tenants.length}</div>
                    {user.tenants.length > 0 && (
                      <div className="text-gray-400">
                        {user.tenants.map((tenant) => (
                          <div key={tenant.id} className="ml-2">
                            • {tenant.name}{' '}
                            {tenant.isSuperUser ? '(Super)' : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Session Info */}
              {session && (
                <div>
                  <div className="text-orange-400 font-semibold mb-1">
                    Session Info:
                  </div>
                  <div className="bg-gray-800 p-2 rounded border text-xs space-y-1">
                    <div>User ID: {session.user?.id}</div>
                    <div>Email: {session.user?.email}</div>
                    <div>Token Type: {session.token_type}</div>
                    <div>
                      Expires At:{' '}
                      {session.expires_at
                        ? new Date(session.expires_at * 1000).toLocaleString()
                        : 'N/A'}
                    </div>
                    <div>
                      Email Confirmed:{' '}
                      {session.user?.email_confirmed_at ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-gray-700">
                <button
                  onClick={handleForceLogout}
                  disabled={isForceLoggingOut}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  {isForceLoggingOut ? 'Logging out...' : '🚪 Force Logout'}
                </button>

                <button
                  onClick={handleRefreshAuthState}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  🔄 Refresh Auth State
                </button>

                <button
                  onClick={copyAuthStateToClipboard}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  📋 Copy State to Clipboard
                </button>
              </div>

              {/* Environment Info */}
              <div className="pt-2 border-t border-gray-700 text-gray-400 text-xs">
                <div>Env: {import.meta.env.MODE}</div>
                <div>API: {import.meta.env.VITE_API_BASE_URL}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
