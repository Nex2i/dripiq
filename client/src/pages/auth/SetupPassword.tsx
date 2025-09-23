import { useState } from 'react'
import { useRouter, useSearch } from '@tanstack/react-router'
import { KeyRound, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import AuthLayout from '../../components/auth/AuthLayout'
import ErrorDisplay from '../../components/auth/ErrorDisplay'
import { supabase } from '../../lib/supabaseClient'
import { invitesService } from '../../services/invites.service'
import { HOME_URL } from '../../constants/navigation'

/**
 * SetupPassword component - now focused only on the actual password setup form
 * Follows Single Responsibility Principle - only handles password setup after confirmation
 */
export default function SetupPassword() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as any
  const isInvited = search?.invited === 'true'

  // Form state
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'setup' | 'success' | 'error'>('setup')

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

      // Ensure we have a valid session before updating password
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()
      if (sessionError || !user) {
        setError(
          'Your session has expired. Please use the link from your email again.',
        )
        return
      }

      // Update the user's password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
      })

      if (updateError) {
        throw updateError
      }

      // Activate the user account in our database (change status from pending to active)
      if (user) {
        try {
          await invitesService.activateUser(user.id)
        } catch (activateError: any) {
          console.warn('Failed to activate user in database:', activateError)
          // Don't fail the whole process if this fails, as the password was set successfully
        }
      }

      setStatus('success')

      // Redirect to home after success
      setTimeout(() => {
        router.navigate({ to: HOME_URL })
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
      <AuthLayout>
        <div className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Password Set Successfully!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Your password has been set. You'll be redirected to the dashboard
            shortly.
          </p>
          <div className="mt-4 animate-pulse">
            <div className="bg-gray-200 rounded h-2 w-full"></div>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout>
        <div className="text-center">
          <XCircle className="mx-auto h-16 w-16 text-red-600" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Setup Failed
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            There was an error setting up your password. Please try again.
          </p>
          <div className="mt-4">
            <button
              onClick={() => setStatus('setup')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
            >
              Try Again
            </button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <KeyRound className="mx-auto h-12 w-12 text-[var(--color-primary-600)]" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Set Your Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isInvited
            ? 'Welcome to the team! Please set a secure password for your account.'
            : 'Please set a secure password for your account.'}
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all duration-200"
                placeholder="Enter your password (min 8 characters)"
                value={formData.password}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent transition-all duration-200"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">Password requirements:</p>
            <ul className="space-y-1">
              <li>• At least 8 characters long</li>
              <li>• Contains uppercase and lowercase letters</li>
              <li>• Contains at least one number</li>
            </ul>
          </div>

          <ErrorDisplay error={error} />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-700)] text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" />
                Setting Password...
              </>
            ) : (
              'Set Password'
            )}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
