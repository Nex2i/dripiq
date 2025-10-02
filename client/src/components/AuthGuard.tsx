import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { HOME_URL } from '../constants/navigation'
import {
  getStoredPreviousRoute,
  storePreviousRoute,
  clearStoredPreviousRoute,
} from '../utils/routeStorage'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading, session } = useAuth()

  if (loading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      )
    )
  }

  if (!session || !user) {
    // Store the current route before redirecting to login
    storePreviousRoute()
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}

interface PublicOnlyGuardProps {
  children: ReactNode
}

export function PublicOnlyGuard({ children }: PublicOnlyGuardProps) {
  const { user, loading, session } = useAuth()
  const isValidUserSession = session && user
  const isLocationAuth = location.pathname.startsWith('/auth')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  if (isValidUserSession && isLocationAuth) {
    // Try to redirect to the stored previous route, otherwise fallback to HOME_URL
    const previousRoute = getStoredPreviousRoute()
    const redirectTo = previousRoute || HOME_URL
    return <Navigate to={redirectTo} replace />
  }

  if (isValidUserSession && !isLocationAuth) {
    clearStoredPreviousRoute()
  }

  return <>{children}</>
}
