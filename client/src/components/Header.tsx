import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'
import { useState, useRef, useEffect } from 'react'
import { Settings, ChevronDown, X, Menu, LogOut } from 'lucide-react'
import AddLeadModal from './AddLeadModal'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false)
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false)
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
      <div className="bg-surface-elevated backdrop-blur-sm shadow-lg border-b border-border-primary/50 sticky top-0 z-50">
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
                  className="text-text-secondary hover:text-primary-500 px-3 py-2 text-sm font-medium bg-transparent border-none cursor-pointer transition-colors duration-200 rounded-lg hover:bg-primary-50"
                >
                  Leads
                </button>
              </nav>
            </div>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={toggleProfileMenu}
                    className="flex items-center space-x-3 text-text-secondary hover:text-text-primary transition-colors duration-200 p-2 rounded-lg hover:bg-neutral-50"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                      <span className="text-text-inverse text-sm font-semibold">
                        {(user.user.name || user.user.email)
                          ?.charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden lg:block text-left">
                      <div className="text-sm font-medium text-text-primary">
                        {user.user.name || user.user.email}
                      </div>
                      {user.tenants && user.tenants.length > 0 && (
                        <div className="text-xs text-text-tertiary">
                          {user.tenants[0].name}
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isProfileMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-surface-primary rounded-xl shadow-xl border border-border-primary z-50">
                      <div className="p-4 border-b border-border-primary">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                            <span className="text-text-inverse text-sm font-semibold">
                              {(user.user.name || user.user.email)
                                ?.charAt(0)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-text-primary">
                              {user.user.name || user.user.email}
                            </div>
                            {user.tenants && user.tenants.length > 0 && (
                              <div className="text-sm text-text-tertiary">
                                {user.tenants[0].name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-2">
                        {/* Settings Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setIsSettingsDropdownOpen(!isSettingsDropdownOpen)
                            }
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                          >
                            <div className="flex items-center space-x-2">
                              <Settings className="h-4 w-4" />
                              <span>Settings</span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isSettingsDropdownOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {isSettingsDropdownOpen && (
                            <div className="mt-1 ml-6 space-y-1">
                              <button
                                onClick={() => {
                                  navigate({ to: '/settings/organization' })
                                  closeProfileMenu()
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                              >
                                Organization
                              </button>
                              <button
                                onClick={() => {
                                  navigate({ to: '/settings/users' })
                                  closeProfileMenu()
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                              >
                                Users
                              </button>
                              <button
                                onClick={() => {
                                  navigate({ to: '/settings/billing' })
                                  closeProfileMenu()
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                              >
                                Billing
                              </button>
                              <button
                                onClick={() => {
                                  navigate({ to: '/settings/security' })
                                  closeProfileMenu()
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                              >
                                Security
                              </button>
                              <button
                                onClick={() => {
                                  navigate({ to: '/settings/notifications' })
                                  closeProfileMenu()
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                              >
                                Notifications
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleLogoutFromMenu}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200 mt-1"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg hover:bg-neutral-50 transition-all duration-200"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={toggleMobileMenu}
                className="text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-neutral-50 transition-colors duration-200"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-surface-primary border-t border-border-primary">
            <div className="px-4 py-4 space-y-3">
              {/* Mobile Navigation Links */}
              <button
                onClick={() => {
                  navigate({ to: '/leads' })
                  closeMobileMenu()
                }}
                className="block w-full text-left px-3 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
              >
                Leads
              </button>

              {/* Mobile Settings Menu */}
              {user && (
                <div>
                  <button
                    onClick={() =>
                      setIsMobileSettingsOpen(!isMobileSettingsOpen)
                    }
                    className="flex items-center justify-between w-full px-3 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <Settings className="h-5 w-5" />
                      <span>Settings</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isMobileSettingsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isMobileSettingsOpen && (
                    <div className="mt-2 ml-6 space-y-2">
                      <button
                        onClick={() => {
                          navigate({ to: '/settings/organization' })
                          closeMobileMenu()
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                      >
                        Organization
                      </button>
                      <button
                        onClick={() => {
                          navigate({ to: '/settings/users' })
                          closeMobileMenu()
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                      >
                        Users
                      </button>
                      <button
                        onClick={() => {
                          navigate({ to: '/settings/billing' })
                          closeMobileMenu()
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                      >
                        Billing
                      </button>
                      <button
                        onClick={() => {
                          navigate({ to: '/settings/security' })
                          closeMobileMenu()
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                      >
                        Security
                      </button>
                      <button
                        onClick={() => {
                          navigate({ to: '/settings/notifications' })
                          closeMobileMenu()
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-text-tertiary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors duration-200"
                      >
                        Notifications
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile User Info */}
              {user && (
                <div className="pt-4 border-t border-border-primary/50">
                  <div className="flex items-center space-x-3 px-4 py-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                      <span className="text-text-inverse text-sm font-semibold">
                        {(user.user.name || user.user.email)
                          ?.charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-text-primary">
                        {user.user.name || user.user.email}
                      </div>
                      {user.tenants && user.tenants.length > 0 && (
                        <div className="text-xs text-text-tertiary">
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
                    className="w-full mt-3 bg-gradient-to-r from-neutral-100 to-neutral-200 hover:from-neutral-200 hover:to-neutral-300 text-text-secondary px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 border border-border-primary hover:border-border-secondary"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {/* Mobile Auth Buttons */}
              {!user && (
                <div className="pt-4 border-t border-border-primary/50 space-y-3">
                  <button
                    onClick={() => {
                      navigate({ to: '/auth/login' })
                      closeMobileMenu()
                    }}
                    className="w-full text-text-secondary hover:text-text-primary px-4 py-3 rounded-xl hover:bg-neutral-50 transition-all duration-200 border border-border-primary hover:border-border-secondary text-center"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      navigate({ to: '/auth/register' })
                      closeMobileMenu()
                    }}
                    className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-4 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 text-center"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
