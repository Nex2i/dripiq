import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { APP_URLS } from '@/constants/app'
import Logo from './Logo'

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Blog', href: '/blog' },
    { name: 'Contact', href: '/contact' },
  ]

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-surface-200 sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <Logo size="md" showText />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="text-surface-700 hover:text-primary-600 transition-colors font-medium"
                  activeProps={{
                    className: 'text-primary-600',
                  }}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href={APP_URLS.LOGIN}
              className="text-surface-700 hover:text-primary-600 transition-colors font-medium"
            >
              Sign In
            </a>
            <a
              href={APP_URLS.SIGNUP}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Start Free Trial
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="text-surface-700 hover:text-primary-600 transition-colors p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-surface-200 py-4">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="text-surface-700 hover:text-primary-600 transition-colors font-medium px-2 py-1"
                  onClick={() => setIsMobileMenuOpen(false)}
                  activeProps={{
                    className: 'text-primary-600',
                  }}
                >
                  {item.name}
                </Link>
              ))}
              <div className="flex flex-col space-y-2 pt-4 border-t border-surface-200">
                <a
                  href={APP_URLS.LOGIN}
                  className="text-surface-700 hover:text-primary-600 transition-colors font-medium px-2 py-1"
                >
                  Sign In
                </a>
                <a
                  href={APP_URLS.SIGNUP}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium text-center"
                >
                  Start Free Trial
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
