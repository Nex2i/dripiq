import React, { useState, useEffect } from 'react'
import { useRouter, useSearch } from '@tanstack/react-router'
import {
  KeyRound,
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  UserPlus,
  Lock,
} from 'lucide-react'
import Logo from '../../components/Logo'
import { supabase } from '../../lib/supabaseClient'
import { invitesService } from '../../services/invites.service'
import { HOME_URL } from '../../constants/navigation'

export default function SetupPassword() {
  const router = useRouter()
  const search = useSearch({ strict: false }) as any
  const confirmationUrl = search?.confirmation_url
  const isInvited = search?.invited === 'true'

  // Determine flow type based on URL parameters or confirmation URL content
  const getFlowType = (): 'new-user' | 'reset-password' => {
    if (isInvited) return 'new-user'
    if (confirmationUrl && confirmationUrl.includes('recovery')) return 'reset-password'
    if (confirmationUrl && confirmationUrl.includes('invite')) return 'new-user'
    // Default fallback
    return 'reset-password'
  }

  const flowType = getFlowType()

  // State
  const [error, setError] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Validate that we have a confirmation URL
  useEffect(() => {
    if (!confirmationUrl) {
      setError('Missing confirmation URL. Please use the link from your email.')
    }
  }, [confirmationUrl])

  // Handle confirmation button click
  const handleConfirmation = async () => {
    if (!confirmationUrl) {
      setError('Missing confirmation URL. Please use the link from your email.')
      return
    }

    try {
      setIsRedirecting(true)
      setError('')

      // Redirect to the confirmation URL
      window.location.href = confirmationUrl
    } catch (err: any) {
      console.error('Redirect error:', err)
      setError('Failed to redirect to password setup. Please try again.')
      setIsRedirecting(false)
    }
  }

  // Get appropriate messaging based on flow type
  const getFlowContent = () => {
    if (flowType === 'new-user') {
      return {
        icon: UserPlus,
        title: 'Complete Your Account Setup',
        subtitle: 'Welcome to the team! Click the button below to set up your password and complete your account.',
        buttonText: 'Set Up My Account',
        instructionText: 'You\'ll be redirected to complete your account setup securely.'
      }
    } else {
      return {
        icon: Lock,
        title: 'Reset Your Password',
        subtitle: 'Click the button below to securely reset your password.',
        buttonText: 'Reset My Password',
        instructionText: 'You\'ll be redirected to set your new password securely.'
      }
    }
  }

  const flowContent = getFlowContent()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[var(--color-primary-50)] to-[var(--color-primary-100)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>
          <div className="text-center">
            <flowContent.icon className="mx-auto h-12 w-12 text-[var(--color-primary-600)]" />
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {flowContent.title}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {flowContent.subtitle}
            </p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
          <div className="space-y-6">
            {/* Information section */}
            <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Mail className="w-4 h-4 mr-2 text-[var(--color-primary-600)]" />
                <p className="font-medium">What happens next:</p>
              </div>
              <ul className="space-y-1 ml-6">
                <li>• {flowContent.instructionText}</li>
                <li>• You'll be able to set your password on the next page</li>
                <li>• The link is secure and will expire for your safety</li>
              </ul>
            </div>

            {/* Error display */}
            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                <div className="flex items-center">
                  <XCircle className="w-4 h-4 mr-2 text-red-600" />
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}

            {/* Confirmation URL display (for debugging/verification) */}
            {confirmationUrl && (
              <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                <p className="font-medium mb-1">Confirmation link ready:</p>
                <p className="break-all font-mono">
                  {confirmationUrl.substring(0, 60)}...
                </p>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={handleConfirmation}
              disabled={isRedirecting || !confirmationUrl}
              className="w-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-700)] text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" />
                  Redirecting...
                </>
              ) : (
                flowContent.buttonText
              )}
            </button>

            {/* Additional help text */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Having trouble? Check your email for the original {flowType === 'new-user' ? 'invitation' : 'password reset'} message and use that link instead.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
