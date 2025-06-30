import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link
                to="/"
                className="flex items-center hover:scale-105 transition-transform duration-200"
              >
                <Logo size="md" showText={true} />
              </Link>

              <nav className="hidden md:flex space-x-6">
                <button
                  onClick={() => navigate({ to: '/demo/table' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate({ to: '/demo/tanstack-query' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  Campaigns
                </button>
                <button
                  onClick={() => navigate({ to: '/demo/form/simple' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  Settings
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="hidden sm:flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {(user.user.name || user.user.email)
                          ?.charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {user.user.name || user.user.email}
                      </div>
                      {user.tenants && user.tenants.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {user.tenants[0].name}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border border-gray-300 hover:border-gray-400"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="text-gray-600 hover:text-blue-600 px-4 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border-none cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
                  >
                    Start Free Trial
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
