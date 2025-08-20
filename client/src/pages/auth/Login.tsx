import React, { useState } from 'react'
import { useRouter, useSearch } from '@tanstack/react-router'
import { CheckCircle, Loader2 } from 'lucide-react'
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[var(--color-primary-50)] to-[var(--color-primary-100)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>
          <div className="text-center mb-4">
            <button
              onClick={() => router.navigate({ to: '/' } as any)}
              className="text-sm text-gray-500 hover:text-gray-700 underline bg-transparent border-none cursor-pointer inline-flex items-center"
            >
              ← Back to Home
            </button>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={() => router.navigate({ to: '/auth/register' } as any)}
              className="font-medium text-[var(--color-primary-600)] hover:text-[var(--color-primary-500)] underline bg-transparent border-none cursor-pointer"
            >
              Sign up for free
            </button>
          </p>
        </div>

        {showRegistrationSuccess && (
          <div className="rounded-md bg-green-50 p-4 border border-green-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-400" />
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
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-700)] text-white py-3 px-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" />
                  Signing in...
                </>
              ) : (
                'Sign in to dripIq'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.navigate({ to: '/privacy-policy' } as any)}
              className="text-sm text-gray-500 hover:text-gray-700 underline bg-transparent border-none cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
