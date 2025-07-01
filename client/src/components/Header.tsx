import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'
import { useState, useRef, useEffect } from 'react'
import AddLeadModal from './AddLeadModal'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const navigateAndClose = (path: string) => {
    navigate({ to: path })
    closeMobileMenu()
  }

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen(!isProfileMenuOpen)
  }

  const closeProfileMenu = () => {
    setIsProfileMenuOpen(false)
  }

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        closeProfileMenu()
      }
    }

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileMenuOpen])

  const handleLogoutFromMenu = async () => {
    closeProfileMenu()
    handleLogout()
  }

  return (
    <>
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link
                to="/dashboard"
                className="flex items-center hover:scale-105 transition-transform duration-200"
              >
                <Logo size="md" showText={true} />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-6">
                <button
                  onClick={() => navigate({ to: '/leads' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  Leads
                </button>
                <button
                  onClick={() => navigate({ to: '/settings/users' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  Users
                </button>
                <button
                  onClick={() => navigate({ to: '/demo/table' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  DemoTable
                </button>
                <button
                  onClick={() => navigate({ to: '/demo/tanstack-query' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  DemoTanstackQuery
                </button>
                <button
                  onClick={() => navigate({ to: '/demo/form/simple' })}
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                >
                  DemoFormSimple
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Add Lead Button */}
              <button
                onClick={() => setIsAddLeadModalOpen(true)}
                className="p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
                aria-label="Add new lead"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
              {/* Mobile Menu Button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
                aria-label="Toggle mobile menu"
              >
                <div className="w-6 h-6 flex flex-col justify-around">
                  <span
                    className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? 'rotate-45 translate-y-2.5' : ''
                    }`}
                  />
                  <span
                    className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? 'opacity-0' : ''
                    }`}
                  />
                  <span
                    className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
                      isMobileMenuOpen ? '-rotate-45 -translate-y-2.5' : ''
                    }`}
                  />
                </div>
              </button>

              {user ? (
                <div className="hidden md:flex items-center">
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={toggleProfileMenu}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                      aria-label="Open profile menu"
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {(user.user.name || user.user.email)
                            ?.charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm hidden sm:block">
                        <div className="font-medium text-gray-900">
                          {user.user.name || user.user.email}
                        </div>
                        {user.tenants && user.tenants.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {user.tenants[0].name}
                          </div>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                          isProfileMenuOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Profile Dropdown Menu */}
                    {isProfileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <button
                          onClick={handleLogoutFromMenu}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
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

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 py-6 bg-white/95 backdrop-blur-sm border-t border-gray-200/50">
            <nav className="flex flex-col space-y-4">
              <button
                onClick={() => navigateAndClose('/leads')}
                className="text-gray-600 hover:text-blue-600 px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-blue-50 text-left"
              >
                Leads
              </button>
              <button
                onClick={() => navigateAndClose('/settings/users')}
                className="text-gray-600 hover:text-blue-600 px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-blue-50 text-left"
              >
                Users
              </button>
              <button
                onClick={() => navigateAndClose('/demo/table')}
                className="text-gray-600 hover:text-blue-600 px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-blue-50 text-left"
              >
                DemoTable
              </button>
              <button
                onClick={() => navigateAndClose('/demo/tanstack-query')}
                className="text-gray-600 hover:text-blue-600 px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-blue-50 text-left"
              >
                DemoTanstackQuery
              </button>
              <button
                onClick={() => navigateAndClose('/demo/form/simple')}
                className="text-gray-600 hover:text-blue-600 px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-blue-50 text-left"
              >
                DemoFormSimple
              </button>

              {/* Mobile User Info */}
              {user && (
                <div className="pt-4 border-t border-gray-200/50">
                  <div className="flex items-center space-x-3 px-4 py-2">
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
                    onClick={() => {
                      handleLogout()
                      closeMobileMenu()
                    }}
                    className="w-full mt-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 border border-gray-300 hover:border-gray-400"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {/* Mobile Auth Buttons */}
              {!user && (
                <div className="pt-4 border-t border-gray-200/50 space-y-3">
                  <button
                    onClick={() => navigateAndClose('/auth/login')}
                    className="w-full text-gray-600 hover:text-blue-600 px-4 py-3 text-base font-medium bg-transparent border border-gray-300 cursor-pointer transition-colors duration-200 rounded-lg hover:bg-blue-50"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => navigateAndClose('/auth/register')}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-base font-semibold border-none cursor-pointer transition-all duration-300"
                  >
                    Start Free Trial
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <AddLeadModal
        isOpen={isAddLeadModalOpen}
        onClose={() => setIsAddLeadModalOpen(false)}
      />
    </>
  )
}
