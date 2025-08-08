import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'
import { useState, useRef, useEffect } from 'react'
import { Settings, User } from 'lucide-react'
import { HOME_URL } from '../constants/navigation'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
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

  const handleLogoutFromMenu = () => {
    closeProfileMenu()
    handleLogout()
  }

  return (
    <>
      <div className="bg-[var(--color-surface-100)]/90 backdrop-blur-sm shadow-lg border-b border-[var(--color-border-light)]/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link
                to={HOME_URL}
                className="flex items-center hover:scale-105 transition-transform duration-200 cursor-pointer"
              >
                <Logo size="md" showText={true} />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-6">
                <button
                  onClick={() => navigate({ to: HOME_URL })}
                  className="text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-[var(--color-primary-50)] hover:shadow-sm transform hover:-translate-y-0.5"
                >
                  Leads
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* Mobile Menu Button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 rounded-lg text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-all duration-200 hover:shadow-md transform hover:scale-105 cursor-pointer"
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
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-[var(--color-surface-100)] transition-all duration-200 hover:shadow-md transform hover:scale-105 cursor-pointer"
                      aria-label="Open profile menu"
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] rounded-full flex items-center justify-center shadow-md">
                        <span className="text-[var(--color-text-inverse)] text-sm font-semibold">
                          {(user.user.name || user.user.email)
                            ?.charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm hidden sm:block">
                        <div className="font-medium text-[var(--color-surface-950)]">
                          {user.user.name || user.user.email}
                        </div>
                        {user.tenants && user.tenants.length > 0 && (
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {user.tenants[0].name}
                          </div>
                        )}
                      </div>
                      <Logo size="sm" showText={false} />
                    </button>

                    {/* Profile Dropdown Menu */}
                    {isProfileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-[var(--color-bg-primary)] rounded-lg shadow-lg border border-[var(--color-border-default)] py-1 z-50 animate-fade-in-scale">
                        <button
                          onClick={() => {
                            navigate({ to: '/profile' })
                            closeProfileMenu()
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[var(--color-surface-950)] hover:bg-[var(--color-surface-100)] hover:text-[var(--color-primary-600)] transition-all duration-200 flex items-center hover:transform hover:translate-x-1 cursor-pointer"
                        >
                          <User className="h-4 w-4 mr-3 text-[var(--color-text-muted)]" />
                          Profile
                        </button>
                        <button
                          onClick={() => {
                            navigate({ to: '/settings' })
                            closeProfileMenu()
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[var(--color-surface-950)] hover:bg-[var(--color-surface-100)] hover:text-[var(--color-primary-600)] transition-all duration-200 flex items-center hover:transform hover:translate-x-1 cursor-pointer"
                        >
                          <Settings className="h-4 w-4 mr-3 text-[var(--color-text-muted)]" />
                          Settings
                        </button>
                        <div className="border-t border-[var(--color-border-light)] my-1"></div>
                        <button
                          onClick={handleLogoutFromMenu}
                          className="w-full text-left px-4 py-2 text-sm text-[var(--color-surface-950)] hover:bg-[var(--color-error-50)] hover:text-[var(--color-error-700)] transition-all duration-200 hover:transform hover:translate-x-1 cursor-pointer"
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
                    className="text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] px-4 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-[var(--color-primary-50)] hover:shadow-sm transform hover:-translate-y-0.5"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-800)] text-[var(--color-text-inverse)] px-4 py-2 rounded-xl text-sm font-semibold border-none cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
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
          <div className="px-4 py-6 bg-[var(--color-surface-100)]/95 backdrop-blur-sm border-t border-[var(--color-border-light)]/50">
            <nav className="flex flex-col space-y-4">
              <button
                onClick={() => navigateAndClose(HOME_URL)}
                className="text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-[var(--color-primary-50)] text-left hover:shadow-sm transform hover:translate-x-2"
              >
                Leads
              </button>
              <button
                onClick={() => navigateAndClose('/profile')}
                className="text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-[var(--color-primary-50)] text-left flex items-center hover:shadow-sm transform hover:translate-x-2"
              >
                <User className="h-5 w-5 mr-3 text-[var(--color-text-muted)]" />
                Profile
              </button>
              <button
                onClick={() => navigateAndClose('/settings')}
                className="text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] px-4 py-3 text-base font-medium bg-transparent border-none cursor-pointer transition-all duration-200 rounded-lg hover:bg-[var(--color-primary-50)] text-left flex items-center hover:shadow-sm transform hover:translate-x-2"
              >
                <Settings className="h-5 w-5 mr-3 text-[var(--color-text-muted)]" />
                Settings
              </button>

              {/* Mobile User Info */}
              {user && (
                <div className="pt-4 border-t border-[var(--color-border-light)]/50">
                  <div className="flex items-center space-x-3 px-4 py-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] rounded-full flex items-center justify-center shadow-md">
                      <span className="text-[var(--color-text-inverse)] text-sm font-semibold">
                        {(user.user.name || user.user.email)
                          ?.charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-[var(--color-surface-950)]">
                        {user.user.name || user.user.email}
                      </div>
                      {user.tenants && user.tenants.length > 0 && (
                        <div className="text-xs text-[var(--color-text-secondary)]">
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
                    className="w-full mt-3 bg-gradient-to-r from-[var(--color-surface-200)] to-[var(--color-surface-300)] hover:from-[var(--color-error-100)] hover:to-[var(--color-error-200)] text-[var(--color-surface-950)] hover:text-[var(--color-error-700)] px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 border border-[var(--color-border-default)] hover:border-[var(--color-error-300)] hover:shadow-md transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {/* Mobile Auth Buttons */}
              {!user && (
                <div className="pt-4 border-t border-[var(--color-border-light)]/50 space-y-3">
                  <button
                    onClick={() => navigateAndClose('/auth/login')}
                    className="w-full text-[var(--color-surface-950)] hover:text-[var(--color-primary-600)] px-4 py-3 text-base font-medium bg-transparent border border-[var(--color-border-default)] cursor-pointer transition-all duration-200 rounded-lg hover:bg-[var(--color-primary-50)] hover:border-[var(--color-primary-300)] hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => navigateAndClose('/auth/register')}
                    className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-800)] text-[var(--color-text-inverse)] px-4 py-3 rounded-xl text-base font-semibold border-none cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5"
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
          className="fixed inset-0 bg-[var(--color-bg-overlay)] backdrop-blur-sm z-40 md:hidden cursor-pointer"
          onClick={closeMobileMenu}
        />
      )}
    </>
  )
}
