import React, { useState, useEffect } from 'react'
import { useRouter, useSearch } from '@tanstack/react-router'
import { KeyRound, CheckCircle, XCircle } from 'lucide-react'
import Logo from '../../components/Logo'
import { supabase } from '../../lib/supabaseClient'
import { invitesService } from '../../services/invites.service'

export default function SetupPassword() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as any
  const isInvited = search?.invited === 'true'

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'setup' | 'success' | 'error'>('setup')

  useEffect(() => {
    // Check if user is already authenticated and has a session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session && !isInvited) {
        // If not invited and no session, redirect to login
        router.navigate({ to: '/auth/login' })
      }
    }

    checkSession()
  }, [router, isInvited])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const validateForm = () => {
    if (!formData.password || !formData.confirmPassword) {
      return 'Please fill in all fields'
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long'
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }

    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(formData.password)
    const hasLowerCase = /[a-z]/.test(formData.password)
    const hasNumbers = /\d/.test(formData.password)

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      // Update the user's password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
      })

      if (updateError) {
        throw updateError
      }

      // Get the current user to activate their account in our database
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        try {
          // Activate the user account in our database (change status from pending to active)
          await invitesService.activateUser(user.id)
        } catch (activateError: any) {
          console.warn('Failed to activate user in database:', activateError)
          // Don't fail the whole process if this fails, as the password was set successfully
        }
      }

      setStatus('success')

      // Redirect to dashboard after success
      setTimeout(() => {
        router.navigate({ to: '/dashboard' })
      }, 2000)
    } catch (err: any) {
      console.error('Password setup error:', err)
      setError(
        err.message || 'An error occurred while setting up your password',
      )
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradient-hero-from via-gradient-hero-via to-gradient-hero-to py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
              Password Set Successfully!
            </h2>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Your password has been set. You'll be redirected to the dashboard
              shortly.
            </p>
            <div className="mt-4 animate-pulse">
              <div className="bg-gray-200 rounded h-2 w-full"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gradient-hero-from via-gradient-hero-via to-gradient-hero-to py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-600" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
              Setup Failed
            </h2>
            <p className="mt-2 text-center text-sm text-text-secondary">
              There was an error setting up your password. Please try again.
            </p>
            <button
              onClick={() => setStatus('setup')}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </div>
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
          <div className="text-center">
            <KeyRound className="mx-auto h-12 w-12 text-primary-500" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
              Set Your Password
            </h2>
            <p className="mt-2 text-center text-sm text-text-secondary">
              {isInvited
                ? 'Welcome to the team! Please set a secure password for your account.'
                : 'Please set a secure password for your account.'}
            </p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-secondary mb-1"
                >
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-surface-primary text-text-primary"
                  placeholder="Enter your password (min 8 characters)"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-secondary mb-1"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-surface-primary text-text-primary"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="text-xs text-text-tertiary bg-neutral-50 p-3 rounded-lg">
              <p className="font-medium mb-1">Password requirements:</p>
              <ul className="space-y-1">
                <li>• At least 8 characters long</li>
                <li>• Contains uppercase and lowercase letters</li>
                <li>• Contains at least one number</li>
              </ul>
            </div>

            {error && (
              <div className="rounded-xl bg-error-50 p-4 border border-error-200">
                <div className="text-sm text-error-700">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse py-3 px-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-text-inverse inline"
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
                  Setting Password...
                </>
              ) : (
                'Set Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
