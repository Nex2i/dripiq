import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { HOME_URL } from '../constants/navigation'

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
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}

interface PublicOnlyGuardProps {
  children: ReactNode
}

export function PublicOnlyGuard({ children }: PublicOnlyGuardProps) {
  const { user, loading, session } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  if (session && user) {
    return <Navigate to={HOME_URL} replace />
  }

  return <>{children}</>
}
