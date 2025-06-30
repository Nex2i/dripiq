import { Link } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { AuthDebugMenu } from './AuthDebugMenu'

export default function Header() {
  const { user, logout, loading } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-gray-900">
                DripIQ
              </Link>

              {user && (
                <nav className="flex space-x-4">
                  <button
                    onClick={() => (window.location.href = '/demo/form/simple')}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer"
                  >
                    Form Demo
                  </button>
                  <button
                    onClick={() => (window.location.href = '/demo/table')}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer"
                  >
                    Table Demo
                  </button>
                  <button
                    onClick={() => (window.location.href = '/demo/store')}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer"
                  >
                    Store Demo
                  </button>
                </nav>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              ) : user ? (
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <span className="text-gray-700">Welcome, </span>
                    <span className="font-medium text-gray-900">
                      {user.user.name || user.user.email}
                    </span>
                  </div>
                  {user.tenants && user.tenants.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {user.tenants[0].name}
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => (window.location.href = '/auth/login')}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => (window.location.href = '/auth/register')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors border-none cursor-pointer"
                  >
                    Sign up
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AuthDebugMenu />
    </>
  )
}
