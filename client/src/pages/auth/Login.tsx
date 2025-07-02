import React, { useState } from 'react'
import { useRouter, useSearch } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import Logo from '../../components/Logo'

export default function Login() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as any
  const { login, loading } = useAuth()
  const showRegistrationSuccess = search?.registered === 'true'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      await login(formData.email, formData.password)
      // Redirect will happen automatically via auth state change
      router.navigate({ to: '/' })
    } catch (err: any) {
      // Handle structured error responses with code and message
      if (err.code && err.message) {
        setError(err.message)
      } else if (err.response?.data?.code && err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError(err.message || 'An error occurred during login')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradient-hero-from via-gradient-hero-via to-gradient-hero-to py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>
          <div className="text-center mb-4">
            <button
              onClick={() => router.navigate({ to: '/' } as any)}
              className="text-sm text-text-tertiary hover:text-text-secondary underline bg-transparent border-none cursor-pointer inline-flex items-center"
            >
              ← Back to Home
            </button>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            Don't have an account?{' '}
            <button
              onClick={() => router.navigate({ to: '/auth/register' } as any)}
              className="font-medium text-primary-500 hover:text-primary-600 underline bg-transparent border-none cursor-pointer"
            >
              Sign up for free
            </button>
          </p>
        </div>

        {showRegistrationSuccess && (
          <div className="rounded-md bg-green-50 p-4 border border-green-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Registration successful!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  We've sent a confirmation email to your email address. Please
                  check your email and click the confirmation link to activate
                  your account before signing in.
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="relative block w-full px-3 py-3 border border-border-primary placeholder-text-muted text-text-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 bg-surface-primary"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="relative block w-full px-3 py-3 border border-border-primary placeholder-text-muted text-text-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 bg-surface-primary"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-error-50 p-4 border border-error-200">
                <div className="text-sm text-error-700">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-lg font-semibold rounded-xl text-text-inverse bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in to dripIq'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
