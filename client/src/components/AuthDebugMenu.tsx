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
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 ${className}`}
    >
      <div className="relative">
        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-primary-500 hover:bg-primary-600 text-text-inverse px-3 py-2 rounded-lg shadow-lg text-sm font-mono flex items-center gap-2 transition-colors"
          title="Auth Debug Menu (Dev Only)"
        >
          <span>Debug</span>
          <span className="text-xs">🔍</span>
        </button>

        {/* Debug Panel */}
        {isOpen && (
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-neutral-900 text-text-inverse p-4 rounded-lg shadow-xl min-w-80 max-w-96 font-mono text-xs border border-neutral-700">
            <div className="space-y-3">
              {/* Auth State */}
              <div className="text-warning-400 font-semibold mb-1">
                Auth State:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span
                    className={loading ? 'text-warning-400' : 'text-success-400'}
                  >
                    Loading: {loading ? 'true' : 'false'}
                  </span>
                </div>
                <div className={user ? 'text-success-400' : 'text-error-400'}>
                  User: {user ? 'authenticated' : 'null'}
                </div>
                <div className={session ? 'text-success-400' : 'text-error-400'}>
                  Session: {session ? 'active' : 'null'}
                </div>
                                 
              </div>

              {/* User Data */}
              {user && (
                <>
                  <div className="text-warning-400 font-semibold mb-1">
                    User Data:
                  </div>
                                     <div className="bg-neutral-800 p-2 rounded border text-xs space-y-1">
                     <div>
                       <span className="text-success-400">ID:</span>{' '}
                       {user.user.id?.substring(0, 8)}...
                     </div>
                     <div>
                       <span className="text-success-400">Email:</span>{' '}
                       {user.user.email}
                     </div>
                     <div className="text-text-muted">
                       <span className="text-success-400">Name:</span>{' '}
                       {user.user.name || 'Not set'}
                     </div>
                     <div>
                       <span className="text-success-400">Created:</span>{' '}
                       {user.user.createdAt
                         ? new Date(user.user.createdAt).toLocaleDateString()
                         : 'Unknown'}
                     </div>
                   </div>
                </>
              )}

              {/* Tenant Data */}
              {user?.tenants && user.tenants.length > 0 && (
                <>
                  <div className="text-warning-400 font-semibold mb-1">
                    Tenant Data:
                  </div>
                  <div className="bg-neutral-800 p-2 rounded border text-xs space-y-1">
                    {user.tenants.map((tenant, index) => (
                      <div key={tenant.id}>
                        <div className="text-success-400">
                          Tenant {index + 1}:
                        </div>
                                                 <div className="ml-2 space-y-1">
                           <div>ID: {tenant.id?.substring(0, 8)}...</div>
                           <div>Name: {tenant.name}</div>
                           <div>Role: {tenant.role?.name || 'No role'}</div>
                         </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-neutral-700">
                <button
                  onClick={handleRefreshAuthState}
                  disabled={loading}
                  className="w-full bg-error-600 hover:bg-error-700 disabled:bg-error-800 disabled:cursor-not-allowed text-text-inverse px-3 py-2 rounded text-sm transition-colors"
                >
                  Refresh Session
                </button>
                <button
                  onClick={handleForceLogout}
                  disabled={isForceLoggingOut}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-text-inverse px-3 py-2 rounded text-sm transition-colors"
                >
                  {isForceLoggingOut ? 'Logging out...' : '� Force Logout'}
                </button>
                <button
                  onClick={copyAuthStateToClipboard}
                  className="w-full bg-success-600 hover:bg-success-700 text-text-inverse px-3 py-2 rounded text-sm transition-colors"
                >
                  📋 Copy State to Clipboard
                </button>
              </div>

              {/* Environment Info */}
              <div className="pt-2 border-t border-neutral-700 text-text-muted text-xs">
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
