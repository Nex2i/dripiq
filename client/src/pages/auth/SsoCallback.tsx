import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function SsoCallback() {
  const router = useRouter()
  const { bootstrapSsoSession } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const handleSsoCallback = async () => {
      try {
        const result = await bootstrapSsoSession()
        if (!mounted) return

        if (result.status === 'requires_registration') {
          router.navigate({
            to: '/auth/register',
            search: {
              sso: 'true',
              email: result.email,
              domain: result.domain,
            },
          } as any)
          return
        }

        if (result.status === 'linking_required') {
          setError(result.message)
          return
        }

        router.navigate({ to: '/' })
      } catch (callbackError: any) {
        if (!mounted) return
        setError(callbackError?.message || 'Failed to complete SSO sign-in')
      }
    }

    void handleSsoCallback()

    return () => {
      mounted = false
    }
  }, [bootstrapSsoSession, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-900">SSO sign-in could not be completed</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.navigate({ to: '/auth/login' })}
            className="mt-4 inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--color-primary-600)]" />
        <p className="mt-3 text-sm text-gray-600">Finalizing SSO sign-in...</p>
      </div>
    </div>
  )
}
