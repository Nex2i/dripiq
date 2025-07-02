import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { user, session } = useAuth()

  const isAuthenticated = !!(session && user)

  const handleGoHome = () => {
    if (isAuthenticated) {
      navigate({ to: '/dashboard' })
    } else {
      navigate({ to: '/' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradient-hero-from via-gradient-hero-via to-gradient-hero-to py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-md w-full space-y-8 text-center relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" showText={true} />
        </div>

        {/* Error Content */}
        <div>
          <h1 className="text-9xl font-extrabold text-primary-500 mb-4">404</h1>
          <h2 className="text-3xl font-bold text-text-primary mb-6">
            Page Not Found
          </h2>
          <p className="text-xl text-text-secondary mb-8">
            Sorry, we couldn't find the page you're looking for. It might have
            been moved, deleted, or you entered the wrong URL.
          </p>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => navigate({ to: isAuthenticated ? '/dashboard' : '/' })}
              className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-8 py-3 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="w-full bg-surface-primary hover:bg-neutral-50 text-text-primary px-8 py-3 rounded-xl text-lg font-semibold border-2 border-border-primary hover:border-border-secondary transition-all duration-300"
            >
              Go Back
            </button>
          </div>

          {/* Additional Help */}
          <div className="mt-8 pt-6 border-t border-border-primary">
            <p className="text-sm text-text-tertiary mb-4">
              Need help? Here are some helpful links:
            </p>
            <div className="flex flex-col sm:flex-row gap-2 text-sm">
              {!isAuthenticated && (
                <>
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="text-primary-500 hover:text-primary-600 underline"
                  >
                    Sign In
                  </button>
                  <span className="hidden sm:inline text-border-secondary">•</span>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="text-primary-500 hover:text-primary-600 underline"
                  >
                    Sign Up
                  </button>
                  <span className="hidden sm:inline text-border-secondary">•</span>
                </>
              )}
              <a
                href="mailto:support@dripiq.com"
                className="text-primary-500 hover:text-primary-600 underline"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Floating animated elements */}
        <div className="absolute top-20 left-8 w-16 h-16 bg-primary-200 rounded-full opacity-20 animate-float-horizontal"></div>
        <div className="absolute bottom-20 right-8 w-12 h-12 bg-secondary-200 rounded-full opacity-25 animate-float-vertical"></div>
        <div className="absolute top-32 right-16 w-10 h-10 bg-success-200 rounded-full opacity-15 animate-float-diagonal"></div>
        <div className="absolute bottom-32 left-16 w-14 h-14 bg-warning-200 rounded-full opacity-20 animate-float-circular"></div>
        <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-error-200 rounded-full opacity-15 animate-float-gentle"></div>
        <div className="absolute top-1/3 right-1/3 w-12 h-12 bg-neutral-300 rounded-full opacity-20 animate-float-swing"></div>

        {/* Additional floating elements */}
        <div className="absolute top-16 right-1/4 w-18 h-18 bg-primary-300 rounded-full opacity-18 animate-float-wave"></div>
        <div className="absolute bottom-16 left-1/3 w-6 h-6 bg-secondary-300 rounded-full opacity-22 animate-float-horizontal"></div>
        <div className="absolute top-2/3 right-12 w-20 h-20 bg-warning-300 rounded-full opacity-12 animate-float-circular"></div>
        <div className="absolute bottom-1/3 left-8 w-9 h-9 bg-success-300 rounded-full opacity-25 animate-float-swing"></div>
        <div className="absolute top-40 left-1/2 w-11 h-11 bg-error-300 rounded-full opacity-17 animate-float-vertical"></div>
      </div>
    </div>
  )
}
