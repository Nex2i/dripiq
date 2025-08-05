import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { user, session } = useAuth()

  const isAuthenticated = !!(session && user)

  const handleGoHome = () => {
    if (isAuthenticated) {
      navigate({ to: '/leads' })
    } else {
      navigate({ to: '/' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[var(--color-primary-50)] to-[var(--color-primary-100)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" showText={true} />
        </div>

        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="relative">
            <div className="text-8xl sm:text-9xl font-bold text-[var(--color-primary-200)] opacity-50">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 text-[var(--color-primary-600)]">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200/20 backdrop-blur-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Oops! The page you're looking for doesn't exist. It might have been
            moved, deleted, or you entered the wrong URL.
          </p>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleGoHome}
              className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-700)] text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              {isAuthenticated ? 'Go to Leads' : 'Go to Home'}
            </button>

            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all duration-200"
            >
              Go Back
            </button>
          </div>

          {/* Additional Help */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Need help? Here are some helpful links:
            </p>
            <div className="flex flex-col sm:flex-row gap-2 text-sm">
              {!isAuthenticated && (
                <>
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] underline"
                  >
                    Sign In
                  </button>
                  <span className="hidden sm:inline text-gray-300">•</span>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] underline"
                  >
                    Sign Up
                  </button>
                  <span className="hidden sm:inline text-gray-300">•</span>
                </>
              )}
              <a
                href="mailto:support@dripiq.com"
                className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] underline"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Floating animated elements */}
        <div className="absolute top-20 left-8 w-16 h-16 bg-[var(--color-primary-200)] rounded-full opacity-20 animate-float-horizontal"></div>
        <div className="absolute bottom-20 right-8 w-12 h-12 bg-[var(--color-primary-200)] rounded-full opacity-25 animate-float-vertical"></div>
        <div className="absolute top-32 right-16 w-10 h-10 bg-purple-200 rounded-full opacity-15 animate-float-diagonal"></div>
        <div className="absolute bottom-32 left-16 w-14 h-14 bg-cyan-200 rounded-full opacity-20 animate-float-circular"></div>
        <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-pink-200 rounded-full opacity-15 animate-float-gentle"></div>
        <div className="absolute top-1/3 right-1/3 w-12 h-12 bg-yellow-200 rounded-full opacity-20 animate-float-swing"></div>

        {/* Additional floating elements */}
        <div className="absolute top-16 right-1/4 w-18 h-18 bg-emerald-200 rounded-full opacity-18 animate-float-wave"></div>
        <div className="absolute bottom-16 left-1/3 w-6 h-6 bg-rose-200 rounded-full opacity-22 animate-float-horizontal"></div>
        <div className="absolute top-2/3 right-12 w-20 h-20 bg-amber-200 rounded-full opacity-12 animate-float-circular"></div>
        <div className="absolute bottom-1/3 left-8 w-9 h-9 bg-violet-200 rounded-full opacity-25 animate-float-swing"></div>
        <div className="absolute top-40 left-1/2 w-11 h-11 bg-teal-200 rounded-full opacity-17 animate-float-vertical"></div>
      </div>
    </div>
  )
}
